from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MachineViewSet,
    LaundrySessionViewSet,
    network_ip_view,
    reports_analytics_view,
    reports_xls_view,
    reports_pdf_view,
    audit_logs_view,
    notifications_view,
    activity_analytics_view,
    auth_login_view,
    auth_change_password_view,
    auth_reset_password_view,
    auth_status_view
)

# 1. Create a REST Framework router
router = DefaultRouter()

# 2. Register our MachineViewSet with the router
# This automatically generates the URLs:
# - GET /api/machines/            (List all)
# - GET /api/machines/<code/      (Single machine details)
router.register(r'machines', MachineViewSet, basename='machine')

# This registers:
# - POST /api/sessions/      (Start wash session & atomic reservation)
# - GET  /api/sessions/      (List all sessions)
# - GET  /api/sessions/<id>/ (Get session timer & status)
router.register(r'sessions', LaundrySessionViewSet, basename='session')

# 3. Include the router's generated URLs
urlpatterns = [
    path('network-ip/', network_ip_view, name='network_ip'),
    path('auth/login/', auth_login_view, name='auth_login'),
    path('auth/change-password/', auth_change_password_view, name='auth_change_password'),
    path('auth/reset-password/', auth_reset_password_view, name='auth_reset_password'),
    path('auth/status/', auth_status_view, name='auth_status'),
    path('reports/analytics/', reports_analytics_view, name='reports_analytics'),
    path('reports/xls/', reports_xls_view, name='reports_xls'),
    path('reports/pdf/', reports_pdf_view, name='reports_pdf'),
    path('activity/analytics/', activity_analytics_view, name='activity_analytics'),
    path('audit-logs/', audit_logs_view, name='audit_logs'),
    path('notifications/', notifications_view, name='notifications'),
    path('', include(router.urls)),
]
