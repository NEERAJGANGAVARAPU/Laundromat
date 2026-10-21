import time
import threading
import logging
from django.db import close_old_connections
from .services import sync_expired_sessions

logger = logging.getLogger(__name__)

# Tracks whether the background thread is already running to avoid duplicates
_scheduler_started = False
_scheduler_lock = threading.Lock()


def session_monitor_loop(interval_seconds=15):
    """
    Background daemon loop:
    Wakes up every `interval_seconds` (default: 15 seconds) to:
    1. Detect any active sessions whose expected completion time has passed.
    2. Mark them completed.
    3. Release machines back to 'available'.
    4. Automatically send the completion email to the customer's phone/inbox.
    """
    logger.info(f"[Laundromat Scheduler] Background monitor active (polling every {interval_seconds}s).")
    print(f"[Laundromat Scheduler] Background monitor active (polling every {interval_seconds}s).")

    while True:
        try:
            # 1. Close any stale database connections before query (best practice for threads)
            close_old_connections()

            # 2. Synchronize expired sessions, free machines, and trigger emails
            healed_count = sync_expired_sessions()

            # 3. Clean up database connections after work is done
            close_old_connections()
        except Exception as e:
            logger.error(f"[Laundromat Scheduler] Error: {e}", exc_info=True)
            print(f"[Laundromat Scheduler] Error: {e}")

        # Sleep until the next heartbeat
        time.sleep(interval_seconds)


def start_background_scheduler(interval_seconds=15):
    """
    Starts the session monitor as a daemon thread.
    Thread dies automatically when the main Django server process exits.
    """
    global _scheduler_started
    with _scheduler_lock:
        if _scheduler_started:
            return
        _scheduler_started = True

        thread = threading.Thread(
            target=session_monitor_loop,
            kwargs={'interval_seconds': interval_seconds},
            daemon=True,
            name="LaundromatSessionMonitorThread"
        )
        thread.start()
        logger.info("✅ Background scheduler thread launched successfully.")
