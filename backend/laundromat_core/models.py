import uuid
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.utils import timezone


class Machine(models.Model):
    """
    Represents an individual physical washer or dryer in the laundromat.
    """
    TYPE_CHOICES = [
        ('washer', 'Washing Machine'),
        ('dryer', 'Dryer'),
    ]

    STATUS_CHOICES = [
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('maintenance', 'Under Maintenance'),
        ('offline', 'Offline'),
    ]

    # Unique code like 'W01', 'D02'. db_index=True makes searching by code ultra fast!
    machine_code = models.CharField(max_length=20, unique=True, db_index=True)
    machine_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    
    
    
    # Optional field for the QR code image path if saved to disk
    qr_code_image = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    
    # Soft deletion: If False, the machine is deactivated/archived without destroying history!
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.machine_code} ({self.get_machine_type_display()})"


class LaundrySession(models.Model):
    """
    Records every customer wash or dry session.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    # UUID prevents guessing of session IDs in API URLs
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Direct machine_code on session table for permanent record keeping even if machine is removed/recreated
    machine_code = models.CharField(max_length=20, blank=True, default='', db_index=True)
    
    # ForeignKey links to Machine, but SET_NULL ensures historical sessions remain intact if machine is decommissioned
    machine = models.ForeignKey(Machine, on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')
    
    customer_name = models.CharField(max_length=100, blank=True, default='')
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=30, blank=True, default='')
    duration_minutes = models.PositiveIntegerField()
    
    started_at = models.DateTimeField(default=timezone.now)
    # The countdown timer on the frontend uses this exact timestamp so page refreshes don't reset the timer!
    expected_end_at = models.DateTimeField()
    completed_at = models.DateTimeField(blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    # Secret device token issued only to the customer who started the wash; prevents session hijacking & unauthorized cancellation
    client_token = models.CharField(max_length=64, blank=True, default='', db_index=True)
    email_sent = models.BooleanField(default=False, help_text="Tracks whether cycle completion email was sent")
    reminder_email_sent = models.BooleanField(default=False, help_text="Tracks whether 5-minute pre-completion reminder email was sent")
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        """Helper function: Returns True if expected time has passed."""
        return timezone.now() >= self.expected_end_at

    def save(self, *args, **kwargs):
        # Auto-generate a client_token if not set
        if not self.client_token:
            self.client_token = uuid.uuid4().hex
        # Guarantee machine_code is always persisted directly in the session table
        if self.machine and not self.machine_code:
            self.machine_code = self.machine.machine_code
        elif not self.machine and self.machine_code:
            m = Machine.objects.filter(machine_code=self.machine_code, is_active=True).first()
            if m:
                self.machine = m
        super().save(*args, **kwargs)

    def __str__(self):
        code = self.machine_code or (self.machine.machine_code if self.machine else 'Unknown')
        return f"Session on {code} for {self.customer_email} [{self.status}]"


class Notification(models.Model):
    """
    Tracks email notification attempts to guarantee no duplicate emails are sent.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # OneToOneField ensures that a session can only ever have ONE notification record (idempotency)
    session = models.OneToOneField(LaundrySession, on_delete=models.CASCADE, related_name='notification')
    
    channel = models.CharField(max_length=20, default='email')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Notification for Session {self.session_id} - {self.status}"


class AuditLog(models.Model):
    """
    Tracks important owner changes (deactivations, overrides, cancellations).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100) # e.g., "MACHINE_DEACTIVATED", "SESSION_CANCELLED"
    record_type = models.CharField(max_length=50) # e.g., "Machine", "LaundrySession"
    record_id = models.CharField(max_length=100)
    change_details = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Audit: {self.action} on {self.record_type} ({self.record_id}) by {self.user}"


# ==========================================================
# SIGNALS: Automatic Machine Status Synchronization
# ==========================================================

@receiver(post_delete, sender=LaundrySession)
def on_session_deleted(sender, instance, **kwargs):
    """
    When a session is deleted (e.g. from Django Admin), immediately
    check if the machine can be freed back to 'available'.
    """
    try:
        machine = instance.machine
        now = timezone.now()
        has_other_active = machine.sessions.filter(status='active', expected_end_at__gt=now).exists()
        if not has_other_active and machine.status == 'in_use':
            machine.status = 'available'
            machine.save(update_fields=['status'])
    except Exception:
        pass


@receiver(post_save, sender=LaundrySession)
def on_session_saved(sender, instance, **kwargs):
    """
    If a session's status is changed to 'completed' or 'cancelled',
    immediately free the machine if no other active sessions exist.
    """
    if instance.status in ('completed', 'cancelled'):
        try:
            machine = instance.machine
            now = timezone.now()
            has_other_active = machine.sessions.filter(status='active', expected_end_at__gt=now).exists()
            if not has_other_active and machine.status == 'in_use':
                machine.status = 'available'
                machine.save(update_fields=['status'])
        except Exception:
            pass
