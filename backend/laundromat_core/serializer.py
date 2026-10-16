from rest_framework import serializers
from django.utils import timezone
from .models import Machine, LaundrySession


class MachineSerializer(serializers.ModelSerializer):
    # 1. Custom fields that are NOT in the database, but calculated on the fly!
    is_available = serializers.SerializerMethodField()
    minutes_remaining = serializers.SerializerMethodField()
    active_session_id = serializers.SerializerMethodField()

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
