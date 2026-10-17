from django.contrib import admin
from .models import Machine, LaundrySession, Notification, AuditLog
from .services import sync_expired_sessions

# Register Your Models Here

@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    # The columns displayed in the admin table
    list_display = ('machine_code', 'machine_type', 'status', 'is_active', 'created_at')
    # Filter buttons in the right sidebar
    list_filter = ('machine_type', 'status', 'is_active')
    
    # Adds a search bar at the top to search by machine code
    search_fields = ('machine_code',)

    def changelist_view(self, request, extra_context=None):
        # Automatically complete any expired sessions whenever admin views machines
        sync_expired_sessions()
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(LaundrySession)
class LaundrySessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'machine', 'customer_email', 'duration_minutes', 'status', 'started_at', 'expected_end_at')
    list_filter = ('status',)
    search_fields = ('customer_email', 'machine__machine_code')

    def changelist_view(self, request, extra_context=None):
        # Automatically complete any expired sessions whenever admin views sessions
        sync_expired_sessions()
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'channel', 'status', 'sent_at')
    list_filter = ('status', 'channel')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'record_type', 'record_id', 'user', 'timestamp')
    # Makes timestamp uneditable so audit logs cannot be falsified
    readonly_fields = ('timestamp',)
