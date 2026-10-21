import os
import sys
from django.apps import AppConfig


class LaundromatCoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'laundromat_core'

    def ready(self):
        """
        Runs automatically when Django finishes initializing.
        Launches the background daemon thread to continuously monitor session expiries.
        """
        # Only launch when running the web server (runserver)
        is_runserver = any('runserver' in arg for arg in sys.argv)
        is_reloader_worker = os.environ.get('RUN_MAIN') == 'true'
        is_direct_runserver = is_runserver and '--noreload' in sys.argv

        # Skip during management commands like makemigrations, migrate, test, shell
        is_management_cmd = any(cmd in sys.argv for cmd in ['makemigrations', 'migrate', 'test', 'shell'])

        if (is_reloader_worker or is_direct_runserver) and not is_management_cmd:
            from .scheduler import start_background_scheduler
            start_background_scheduler(interval_seconds=15)
