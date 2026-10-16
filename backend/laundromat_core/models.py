import uuid
from django.db import models
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
        return f"{self.machine_code} ({self.get_machine_type_display()}) - {self.status}"


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
    
    # CRITICAL SAFEGUARD: on_delete=models.PROTECT prevents deleting a machine if it has past sessions!
    machine = models.ForeignKey(Machine, on_delete=models.PROTECT, related_name='sessions')
    
    customer_email = models.EmailField()
    duration_minutes = models.PositiveIntegerField()
    
    started_at = models.DateTimeField(default=timezone.now)
    # The countdown timer on the frontend uses this exact timestamp so page refreshes don't reset the timer!
    expected_end_at = models.DateTimeField()
    completed_at = models.DateTimeField(blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        """Helper function: Returns True if expected time has passed."""
        return timezone.now() >= self.expected_end_at

    def __str__(self):
        return f"Session on {self.machine.machine_code} for {self.customer_email} [{self.status}]"


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
