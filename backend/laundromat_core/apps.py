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
            self.ensure_admin_user()

    def ensure_admin_user(self):
        """
        Ensures the owner admin account exists in SQLite, seeded from environment variables.
        """
        try:
            from django.contrib.auth.models import User
            admin_user_name = os.environ.get('ADMIN_USERNAME', 'admin').strip()
            admin_default_pass = os.environ.get('ADMIN_PASSWORD', 'admin123')
            admin_user = User.objects.filter(username__iexact=admin_user_name).first()
            if not admin_user:
                User.objects.create_superuser(
                    username=admin_user_name,
                    email='',
                    password=admin_default_pass
                )
        except Exception:
            pass
