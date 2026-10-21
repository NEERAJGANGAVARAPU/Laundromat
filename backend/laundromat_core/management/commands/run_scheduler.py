import time
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import close_old_connections
from laundromat_core.services import sync_expired_sessions
from laundromat_core.models import LaundrySession


class Command(BaseCommand):
    help = "Runs the standalone background scheduler to monitor session expiry and trigger completion emails."

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=15,
            help='Polling interval in seconds (default: 15)'
        )

    def handle(self, *args, **options):
        interval = options['interval']
        self.stdout.write(self.style.SUCCESS(f"[Laundromat Scheduler] Standalone scheduler started. Polling every {interval}s..."))
        self.stdout.write(self.style.NOTICE("Press Ctrl+C to stop."))

        try:
            while True:
                now_str = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
                close_old_connections()

                # Check active sessions count
                active_count = LaundrySession.objects.filter(status='active').count()
                
                # Run synchronization
                healed = sync_expired_sessions()
                close_old_connections()

                if healed > 0:
                    self.stdout.write(self.style.SUCCESS(f"[{now_str}] Processed {healed} expired session(s) & updated machine statuses."))
                else:
                    self.stdout.write(f"[{now_str}] Checked {active_count} active session(s). All running smoothly.")

                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\n[Laundromat Scheduler] Scheduler stopped cleanly by user."))
