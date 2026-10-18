from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MachineViewSet, LaundrySessionViewSet, network_ip_view

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
    path('', include(router.urls)),
]
