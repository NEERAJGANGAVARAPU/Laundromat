from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MachineViewSet

# 1. Create a REST Framework router
router = DefaultRouter()

# 2. Register our MachineViewSet with the router
# This automatically generates the URLs:
# - GET /api/machines/            (List all)
# - GET /api/machines/<code/      (Single machine details)
router.register(r'machines', MachineViewSet, basename='machine')

# 3. Include the router's generated URLs
urlpatterns = [
    path('', include(router.urls)),
]
