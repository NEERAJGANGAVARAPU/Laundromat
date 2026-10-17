from rest_framework import serializers
from django.utils import timezone
from .models import Machine, LaundrySession


class MachineSerializer(serializers.ModelSerializer):
    # 1. Custom fields that are NOT in the database, but calculated on the fly!
    is_available = serializers.SerializerMethodField()
    minutes_remaining = serializers.SerializerMethodField()
    active_session_id = serializers.SerializerMethodField()
    expected_end_at = serializers.SerializerMethodField()

    class Meta:
        model = Machine
        # The exact list of JSON keys that will be sent to the frontend
        fields = [
            'id',
            'machine_code',
            'machine_type',
            'status',
            'is_active',
            'is_available',
            'minutes_remaining',
            'active_session_id',
            'expected_end_at',
            'created_at',
        ]

    def get_active_session(self, obj):
        """
        Helper method: Searches the database for any session currently
        running on this specific machine whose timer hasn't expired yet.
        """
        now = timezone.now()
        # obj.sessions comes from the related_name='sessions' we wrote in models.py!
        return obj.sessions.filter(status='active', expected_end_at__gt=now).first()

    def get_is_available(self, obj):
        """
        Calculates the 'is_available' field.
        Returns True ONLY if:
        1. The machine is active (not decommissioned)
        2. Its status is 'available' (not under maintenance or offline)
        3. No customer currently has an active, running session on it
        """
        if not obj.is_active or obj.status != 'available':
            return False
        
        # If there's an ongoing session, it is NOT available
        return self.get_active_session(obj) is None

    def get_minutes_remaining(self, obj):
        """
        Calculates the 'minutes_remaining' field.
        If someone is using the machine, tells the customer how many minutes are left.
        """
        active_session = self.get_active_session(obj)
        if active_session:
            # Subtract current time from expected_end_at
            remaining_seconds = (active_session.expected_end_at - timezone.now()).total_seconds()
            # Convert seconds to whole minutes
            return max(0, int(remaining_seconds // 60))
        return 0

    def get_active_session_id(self, obj):
        """
        Returns the UUID of the running session so the customer's phone
        knows which session it is tracking.
        """
        active_session = self.get_active_session(obj)
        return str(active_session.id) if active_session else None

    def get_expected_end_at(self, obj):
        """
        Returns the expected completion ISO timestamp of the current active session.
        """
        active_session = self.get_active_session(obj)
        return active_session.expected_end_at.isoformat() if active_session else None

class LaundrySessionSerializer(serializers.ModelSerializer):
    """
    Translates LaundrySession records to and from JSON.
    """
    machine_code = serializers.CharField(source='machine.machine_code', read_only=True)
    machine_type = serializers.CharField(source='machine.machine_type', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = LaundrySession
        fields = [
            'id',
            'machine_code',
            'machine_type',
            'customer_email',
            'duration_minutes',
            'started_at',
            'expected_end_at',
            'completed_at',
            'status',
            'is_expired',
            'created_at',
        ]
        read_only_fields = ['id', 'started_at', 'expected_end_at', 'completed_at', 'status', 'created_at']
