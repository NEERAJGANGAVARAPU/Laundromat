from rest_framework import viewsets
from .models import Machine
from .serializer import MachineSerializer  # Imports the serializer you just created!
from django.http import HttpResponse
from rest_framework.decorators import action
from .qr_utils import generate_qr_image



class MachineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows machines to be viewed:
    - GET /api/machines/          -> Returns a list of all active machines
    - GET /api/machines/<machine_code>/ -> Returns details of a specific machine (e.g., W-1)
    """
    # 1. Which machines to get from the database?
    # Only show active machines (not soft-deleted ones) and sort them alphabetically
    queryset = Machine.objects.filter(is_active=True).order_by('machine_code')

    # 2. Which serializer should translate the data?
    serializer_class = MachineSerializer

    # 3. How should we find a specific machine in the URL?
    # By default, Django looks up by database ID (e.g. /api/machines/1/).
    # By setting lookup_field = 'machine_code', we can look up by code (e.g. /api/machines/W-1/)!
    lookup_field = 'machine_code'

    @action(detail=True, methods=['get'], url_path='qr')
    def qr_code(self, request, machine_code=None):
        """
        GET /api/machines/<machine_code>/qr/
        Returns the machine's QR code as a PNG image stream.
        """
        machine = self.get_object()
        image_bytes = generate_qr_image(machine.machine_code)
        return HttpResponse(image_bytes, content_type="image/png")

