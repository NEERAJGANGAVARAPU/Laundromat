from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse

from .models import Machine, LaundrySession
from .serializer import MachineSerializer, LaundrySessionSerializer
from .qr_utils import generate_qr_image
from .services import sync_expired_sessions


class MachineViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Machines:
    - GET /api/machines/                -> Returns a list of all active machines
    - POST /api/machines/               -> Owner can add a new machine
    - GET /api/machines/<machine_code>/ -> Returns details of a specific machine (e.g. W-1)
    - PATCH /api/machines/<machine_code>/ -> Owner can toggle status (e.g. maintenance)
    - DELETE /api/machines/<machine_code>/ -> Safely deactivates machine without corrupting history
    """
    serializer_class = MachineSerializer
    lookup_field = 'machine_code'

    def get_queryset(self):
        # Automatically complete any expired sessions before returning machine data
        sync_expired_sessions()
        return Machine.objects.filter(is_active=True).order_by('machine_code')

    def destroy(self, request, *args, **kwargs):
        """
        Soft-deletion safeguard:
        Never permanently delete machines with past sessions; archive them!
        """
        machine = self.get_object()
        machine.is_active = False
        machine.save(update_fields=['is_active'])
        return Response(
            {"message": f"Machine {machine.machine_code} deactivated successfully."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'], url_path='qr')
    def qr_code(self, request, machine_code=None):
        """
        GET /api/machines/<machine_code>/qr/
        Returns the machine's QR code as a PNG image stream.
        """
        machine = self.get_object()
        image_bytes = generate_qr_image(machine.machine_code)
        return HttpResponse(image_bytes, content_type="image/png")

class LaundrySessionViewSet(viewsets.ModelViewSet):
    """
    API Endpoints for Laundry Sessions:
    - POST /api/sessions/  -> Atomically reserves a machine and starts a session
    - GET  /api/sessions/  -> Lists sessions
    - GET  /api/sessions/<id>/ -> Retrieves a specific session and timer status
    """
    serializer_class = LaundrySessionSerializer

    def get_queryset(self):
        # Automatically complete any expired sessions before returning session list
        sync_expired_sessions()
        return LaundrySession.objects.all().order_by('-started_at')

    def create(self, request, *args, **kwargs):
        """
        ATOMIC RESERVATION LOGIC:
        Prevents double-booking using database-level locking (select_for_update).
        """
        # Ensure any expired sessions are released first!
        sync_expired_sessions()

        # 1. Extract inputs from customer form
        machine_code = request.data.get('machine_code')
        customer_email = request.data.get('customer_email')
        duration_minutes = request.data.get('duration_minutes')

        # 2. Basic input validations
        if not machine_code or not customer_email or not duration_minutes:
            return Response(
                {"error": "machine_code, customer_email, and duration_minutes are all required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            duration_minutes = int(duration_minutes)
            if duration_minutes <= 0 or duration_minutes > 180:
                raise ValueError()
        except ValueError:
            return Response(
                {"error": "duration_minutes must be a positive number between 1 and 180."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. OPEN THE ATOMIC TRANSACTION (Database Mutex Lock!)
        with transaction.atomic():
            # A. Fetch the machine with a row lock!
            # 'select_for_update()' tells the database: "Hold this row! Nobody else can touch it until I finish!"
            try:
                machine = Machine.objects.select_for_update().get(
                    machine_code=machine_code,
                    is_active=True
                )
            except Machine.DoesNotExist:
                return Response(
                    {"error": f"Machine '{machine_code}' does not exist or is inactive."},
                    status=status.HTTP_404_NOT_FOUND
                )

            # B. Check if the machine is available
            if machine.status != 'available':
                return Response(
                    {
                        "error": f"Machine {machine.machine_code} is currently {machine.get_status_display()} and cannot be reserved.",
                        "status": machine.status
                    },
                    status=status.HTTP_409_CONFLICT
                )

            # C. Check if any running session already exists on this machine
            now = timezone.now()
            running_session = machine.sessions.filter(status='active', expected_end_at__gt=now).first()
            if running_session:
                return Response(
                    {
                        "error": f"Machine {machine.machine_code} already has an active wash in progress.",
                        "expected_end_at": running_session.expected_end_at
                    },
                    status=status.HTTP_409_CONFLICT
                )

            # D. YOU WON THE RACE! Safely mark machine as in_use
            machine.status = 'in_use'
            machine.save()

            # E. Calculate exact server-side timestamps
            started_at = now
            expected_end_at = started_at + timedelta(minutes=duration_minutes)

            # F. Save the LaundrySession in the database
            session = LaundrySession.objects.create(
                machine=machine,
                customer_email=customer_email.strip().lower(),
                duration_minutes=duration_minutes,
                started_at=started_at,
                expected_end_at=expected_end_at,
                status='active'
            )

            # G. Return the created session details with HTTP 201 Created!
            serializer = self.get_serializer(session)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='active')
    def active_session(self, request):
        """
        GET /api/sessions/active/?machine=W-1
        Quickly check if a machine currently has an ongoing wash session.
        """
        machine_code = request.query_params.get('machine')
        if not machine_code:
            return Response(
                {"error": "Query parameter 'machine' is required (e.g. ?machine=W-1)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        session = LaundrySession.objects.filter(
            machine__machine_code=machine_code,
            status='active',
            expected_end_at__gt=now
        ).first()

        if not session:
            return Response({"active_session": None}, status=status.HTTP_200_OK)

        serializer = self.get_serializer(session)
        return Response({"active_session": serializer.data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_session(self, request, pk=None):
        """
        POST /api/sessions/<id>/cancel/
        Safely cancels a running wash session early and immediately releases the machine.
        """
        session = self.get_object()
        if session.status != 'active':
            return Response(
                {"error": f"Session cannot be cancelled because it is already {session.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        session.status = 'cancelled'
        session.completed_at = timezone.now()
        session.save(update_fields=['status', 'completed_at'])

        serializer = self.get_serializer(session)
        return Response(
            {
                "message": f"Session cancelled successfully. Machine {session.machine.machine_code} is now available.",
                "session": serializer.data
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_session(self, request, pk=None):
        """
        POST /api/sessions/<id>/complete/
        Explicitly completes a session when the countdown reaches 00:00.
        """
        session = self.get_object()
        if session.status == 'active':
            session.status = 'completed'
            session.completed_at = timezone.now()
            session.save(update_fields=['status', 'completed_at'])

        serializer = self.get_serializer(session)
        return Response(
            {
                "message": f"Session completed. Machine {session.machine.machine_code} is now available.",
                "session": serializer.data
            },
            status=status.HTTP_200_OK
        )


