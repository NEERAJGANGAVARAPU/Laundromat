from datetime import timedelta
from django.utils import timezone
from .models import Machine, LaundrySession
from .email_service import send_cycle_completed_email, send_cycle_reminder_email


def sync_expired_sessions():
    """
    Auto-expiry and machine status synchronization:
    1. Finds all active laundry sessions whose expected_end_at has elapsed,
       marks them as 'completed' and sets completed_at.
    2. Sends completion notification email to customer (if not yet sent).
    3. Sends a 5-minute heads-up reminder email to customers whose cycles are almost done.
    4. Heals any machines marked 'in_use' that do not have an active running session
       (e.g., if an ongoing session was deleted, cancelled, or finished).
    """
    now = timezone.now()

    # 1. Complete expired active sessions (Atomic CAS to prevent concurrent duplicates)
    expired_sessions = LaundrySession.objects.filter(
        status='active',
        expected_end_at__lte=now
    ).select_related('machine')

    for session in expired_sessions:
        # Atomic claim: Only the winning thread updates status from 'active' to 'completed'
        rows_claimed = LaundrySession.objects.filter(
            id=session.id,
            status='active'
        ).update(
            status='completed',
            completed_at=session.expected_end_at
        )

        if rows_claimed == 1:
            session.status = 'completed'
            session.completed_at = session.expected_end_at
            # Notify customer that wash/dry is complete
            try:
                send_cycle_completed_email(session)
            except Exception:
                pass

    # 2. Send 5-minute pre-completion warning reminder to active cycles (Atomic CAS)
    reminder_threshold = now + timedelta(minutes=5)
    sessions_needing_reminder = LaundrySession.objects.filter(
        status='active',
        reminder_email_sent=False,
        duration_minutes__gt=5,
        expected_end_at__lte=reminder_threshold,
        expected_end_at__gt=now
    ).select_related('machine')

    for session in sessions_needing_reminder:
        # Atomic claim: Only the winning thread/request updates reminder_email_sent from False to True
        # If another concurrent request or thread tries simultaneously, rows_claimed is 0 and it skips!
        rows_claimed = LaundrySession.objects.filter(
            id=session.id,
            reminder_email_sent=False,
            status='active'
        ).update(reminder_email_sent=True)

        if rows_claimed == 1:
            try:
                session.reminder_email_sent = True
                send_cycle_reminder_email(session, already_claimed=True)
            except Exception:
                pass

    # 3. Heal any machines marked 'in_use' with no active session
    in_use_machines = Machine.objects.filter(status='in_use')
    healed_count = 0
    for machine in in_use_machines:
        has_active = machine.sessions.filter(status='active', expected_end_at__gt=now).exists()
        if not has_active:
            machine.status = 'available'
            machine.save(update_fields=['status'])
            healed_count += 1

    return healed_count
