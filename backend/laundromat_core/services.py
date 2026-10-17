from django.utils import timezone
from .models import Machine, LaundrySession


def sync_expired_sessions():
    """
    Auto-expiry helper:
    Finds all active laundry sessions whose expected_end_at has elapsed.
    1. Updates the session status to 'completed' and sets completed_at.
    2. Frees the associated machine back to 'available' if no other active sessions exist.
    """
    now = timezone.now()
    expired_sessions = LaundrySession.objects.filter(
        status='active',
        expected_end_at__lte=now
    ).select_related('machine')

    updated_count = 0
    for session in expired_sessions:
        session.status = 'completed'
        if not session.completed_at:
            session.completed_at = session.expected_end_at
        session.save(update_fields=['status', 'completed_at'])

        # Free the machine back to available
        machine = session.machine
        has_other_active = machine.sessions.filter(status='active', expected_end_at__gt=now).exists()
        if not has_other_active and machine.status == 'in_use':
            machine.status = 'available'
            machine.save(update_fields=['status'])

        updated_count += 1

    return updated_count
