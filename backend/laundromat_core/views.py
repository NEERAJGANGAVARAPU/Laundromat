import socket
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.http import HttpResponse

from .models import Machine, LaundrySession
from .serializer import MachineSerializer, LaundrySessionSerializer
from .qr_utils import generate_qr_image
from .services import sync_expired_sessions


@api_view(['GET'])
@permission_classes([AllowAny])
def network_ip_view(request):
    """
    GET /api/network-ip/
    Dynamically detects the computer's current Wi-Fi/LAN IP address.
    Never needs hardcoding, works across any Wi-Fi or hotspot automatically!
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = '127.0.0.1'
    return Response({'ip': ip, 'hostname': socket.gethostname()})


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

    def create(self, request, *args, **kwargs):
        """
        POST /api/machines/
        Allows Owner to add a new machine.
        If a machine with this code was previously removed:
        - If it still has historical sessions: Block reuse until sessions are deleted.
        - If it has 0 sessions: Clean up the old removed record and allow creating the new machine!
        """
        raw_code = request.data.get('machine_code', '').strip().upper()
        if not raw_code:
            return Response({"error": "Machine code is required."}, status=status.HTTP_400_BAD_REQUEST)

        existing = Machine.objects.filter(machine_code__iexact=raw_code).first()
        if existing:
            if existing.is_active:
                return Response(
                    {"error": f"Machine '{existing.machine_code}' already exists and is active."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                session_count = existing.sessions.count()
                if session_count > 0:
                    return Response(
                        {
                            "error": f"Machine code '{existing.machine_code}' was previously removed but still has {session_count} customer session(s) in the database. Please delete those sessions in Reports first to reuse this code."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                else:
                    # No sessions exist on this removed machine! Purge it so the code is completely free to reuse.
                    existing.delete()

        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['machine_code'] = raw_code
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        """
        Safe deletion:
        Always marks machine as inactive (is_active=False) so it is removed from the floor
        view, but preserved in the Reports tab as 'removed'.
        """
        machine = self.get_object()
        machine_code = machine.machine_code
        machine.is_active = False
        machine.save(update_fields=['is_active'])
        return Response(
            {"message": f"Machine {machine_code} removed. Preserved in Reports as removed."},
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
        customer_name = request.data.get('customer_name', '').strip()
        customer_phone = request.data.get('customer_phone', '').strip()
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
                customer_name=customer_name,
                customer_email=customer_email.strip().lower(),
                customer_phone=customer_phone,
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

    def update(self, request, *args, **kwargs):
        """
        PUT/PATCH /api/sessions/<id>/
        Allows Owner to update customer name, phone, email, duration, or change session status.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        prev_status = instance.status

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        session = serializer.save()

        # Synchronize machine availability if status changed
        if prev_status == 'active' and session.status in ['completed', 'cancelled']:
            if session.machine:
                session.machine.status = 'available'
                session.machine.save(update_fields=['status'])
            if not session.completed_at:
                session.completed_at = timezone.now()
                session.save(update_fields=['completed_at'])
        elif prev_status != 'active' and session.status == 'active':
            if session.machine:
                session.machine.status = 'in_use'
                session.machine.save(update_fields=['status'])

        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        DELETE /api/sessions/<id>/
        Allows Owner to delete a session and safely releases the machine if the deleted session was active.
        If the machine was previously removed and now has 0 remaining sessions, clean it up so the code can be reused!
        """
        session = self.get_object()
        machine = session.machine
        machine_code = session.machine_code or (machine.machine_code if machine else None)

        if session.status == 'active' and machine:
            machine.status = 'available'
            machine.save(update_fields=['status'])

        session_id = str(session.id)
        session.delete()

        return Response(
            {"message": f"Session {session_id} successfully deleted."},
            status=status.HTTP_200_OK
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def reports_analytics_view(request):
    """
    GET /api/reports/analytics/?date=YYYY-MM-DD
    Returns day-wise KPIs, machine utilization breakdown, and unique people count.
    """
    from .reports import get_day_wise_analytics
    date_str = request.query_params.get('date', 'all')
    data = get_day_wise_analytics(date_str)
    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def reports_csv_view(request):
    """
    GET /api/reports/csv/?date=YYYY-MM-DD&status=...&search=...
    Streams a CSV file containing all filtered session records.
    """
    from .reports import export_sessions_csv
    date_str = request.query_params.get('date', 'all')
    status_filter = request.query_params.get('status', 'all')
    search_query = request.query_params.get('search', '')
    return export_sessions_csv(date_str, status_filter, search_query)


@api_view(['GET'])
@permission_classes([AllowAny])
def reports_pdf_view(request):
    """
    GET /api/reports/pdf/?date=YYYY-MM-DD&status=...&search=...
    Generates and streams a formatted PDF report with KPI summaries and table breakdown.
    """
    from .reports import export_sessions_pdf
    date_str = request.query_params.get('date', 'all')
    status_filter = request.query_params.get('status', 'all')
    search_query = request.query_params.get('search', '')
    return export_sessions_pdf(date_str, status_filter, search_query)


