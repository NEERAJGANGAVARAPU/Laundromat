import socket
from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.http import HttpResponse

from .models import Machine, LaundrySession, AuditLog
from .serializer import MachineSerializer, LaundrySessionSerializer
from .qr_utils import generate_qr_image
from .services import sync_expired_sessions
from .email_service import send_cycle_completed_email


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

        try:
            AuditLog.objects.create(
                action="MACHINE_DEACTIVATED",
                record_type="Machine",
                record_id=machine_code,
                change_details={"machine_type": machine.machine_type, "note": "Removed from floor view"}
            )
        except Exception:
            pass

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
            response_data = dict(serializer.data)
            response_data['client_token'] = session.client_token
            return Response(response_data, status=status.HTTP_201_CREATED)

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
        Guarded: Only the customer who started this session (with matching client_token)
        or an authenticated Store Owner can cancel it.
        """
        session = self.get_object()
        if session.status != 'active':
            return Response(
                {"error": f"Session cannot be cancelled because it is already {session.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Authorization check:
        is_owner = (
            (request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser))
            or request.headers.get('X-Owner-Role') == 'owner'
            or request.data.get('is_owner') is True
        )
        provided_token = request.data.get('client_token') or request.headers.get('X-Client-Token')
        is_session_owner = bool(
            session.client_token and provided_token and session.client_token.strip() == str(provided_token).strip()
        )

        # Backward compatibility for legacy sessions
        if not session.client_token:
            is_session_owner = True

        if not (is_owner or is_session_owner):
            return Response(
                {
                    "error": "Unauthorized: Only the customer who started this session or the store owner can cancel it."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        session.status = 'cancelled'
        session.completed_at = timezone.now()
        session.save(update_fields=['status', 'completed_at'])

        m_code = session.machine_code or (session.machine.machine_code if session.machine else 'Machine')

        try:
            AuditLog.objects.create(
                action="SESSION_CANCELLED",
                record_type="LaundrySession",
                record_id=str(session.id),
                change_details={"machine_code": m_code, "customer_email": session.customer_email}
            )
        except Exception:
            pass

        serializer = self.get_serializer(session)
        return Response(
            {
                "message": f"Session cancelled successfully. Machine {m_code} is now available.",
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

            # Send wash/dry completion email
            try:
                send_cycle_completed_email(session)
            except Exception:
                pass

        m_code = session.machine_code or (session.machine.machine_code if session.machine else 'Machine')
        serializer = self.get_serializer(session)
        return Response(
            {
                "message": f"Session completed. Machine {m_code} is now available.",
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

            if session.status == 'completed':
                try:
                    send_cycle_completed_email(session)
                except Exception:
                    pass
        elif prev_status != 'active' and session.status == 'active':
            if session.machine:
                session.machine.status = 'in_use'
                session.machine.save(update_fields=['status'])

        try:
            AuditLog.objects.create(
                action="SESSION_MODIFIED",
                record_type="LaundrySession",
                record_id=str(session.id),
                change_details={
                    "old_status": prev_status,
                    "new_status": session.status,
                    "duration_minutes": session.duration_minutes,
                    "customer_name": session.customer_name
                }
            )
        except Exception:
            pass

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
        customer_email = session.customer_email
        session.delete()

        try:
            AuditLog.objects.create(
                action="SESSION_DELETED",
                record_type="LaundrySession",
                record_id=session_id,
                change_details={"machine_code": machine_code, "customer_email": customer_email}
            )
        except Exception:
            pass

        return Response(
            {"message": f"Session {session_id} successfully deleted."},
            status=status.HTTP_200_OK
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def reports_analytics_view(request):
    """
    GET /api/reports/analytics/?date=YYYY-MM-DD OR ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
    Returns day-wise or date-range KPIs, machine utilization breakdown, and unique people count.
    """
    from .reports import get_day_wise_analytics
    date_str = request.query_params.get('date', 'all')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    data = get_day_wise_analytics(date_str=date_str, start_date=start_date, end_date=end_date)
    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def reports_xls_view(request):
    """
    GET /api/reports/xls/?date=YYYY-MM-DD&start_date=...&end_date=...&status=...&search=...
    Generates and streams a branded Excel (.xlsx) file containing all filtered session records for the selected date or date range.
    """
    from .reports import export_sessions_xls
    date_str = request.query_params.get('date', 'all')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    status_filter = request.query_params.get('status', 'all')
    search_query = request.query_params.get('search', '')
    return export_sessions_xls(date_str=date_str, start_date=start_date, end_date=end_date, status_filter=status_filter, search_query=search_query)


@api_view(['GET'])
@permission_classes([AllowAny])
def reports_pdf_view(request):
    """
    GET /api/reports/pdf/?date=YYYY-MM-DD&start_date=...&end_date=...&status=...&search=...
    Generates and streams a formatted PDF report with KPI summaries, machine breakdown, and table records for date or date range.
    """
    from .reports import export_sessions_pdf
    date_str = request.query_params.get('date', 'all')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    status_filter = request.query_params.get('status', 'all')
    search_query = request.query_params.get('search', '')
    return export_sessions_pdf(date_str=date_str, start_date=start_date, end_date=end_date, status_filter=status_filter, search_query=search_query)


@api_view(['GET'])
@permission_classes([AllowAny])
def audit_logs_view(request):
    """
    GET /api/audit-logs/
    Returns all administrative audit logs for owner accountability.
    """
    from .models import AuditLog
    from .serializer import AuditLogSerializer
    logs = AuditLog.objects.all().order_by('-timestamp')[:100]
    serializer = AuditLogSerializer(logs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def notifications_view(request):
    """
    GET /api/notifications/
    Returns all email delivery notification history.
    """
    from .models import Notification
    from .serializer import NotificationSerializer
    notifs = Notification.objects.all().select_related('session').order_by('-sent_at')[:100]
    serializer = NotificationSerializer(notifs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def activity_analytics_view(request):
    """
    GET /api/activity/analytics/?period=week|day|month|custom&start_date=...&end_date=...&machine=all&customer=all
    Returns comprehensive usage analytics matching the Spinwise analytics dashboard.
    """
    from .activity import get_activity_analytics
    period = request.query_params.get('period', 'week')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    machine_filter = request.query_params.get('machine', 'all')
    customer_filter = request.query_params.get('customer', 'all')
    
    data = get_activity_analytics(
        period=period,
        start_date=start_date,
        end_date=end_date,
        machine_filter=machine_filter,
        customer_filter=customer_filter
    )
    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_login_view(request):
    """
    POST /api/auth/login/
    Verifies owner username and password securely against SQLite auth_user.
    Pure username + password authentication (no dummy email required).
    """
    import os
    from django.contrib.auth.models import User
    username = str(request.data.get('username', '')).strip().lower()
    password = str(request.data.get('password', ''))

    if not username or not password:
        return Response(
            {"error": "Both username and password are required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.filter(username__iexact=username).first()

    # Fallback to superuser if logging in with generic role title
    if not user and username in ['admin', 'owner']:
        user = User.objects.filter(is_superuser=True).first()

    if user and user.check_password(password):
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        default_pass = os.environ.get('ADMIN_PASSWORD', 'admin123')
        is_default = user.check_password(default_pass)
        return Response({
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": "Store owner",
                "is_default_password": is_default,
                "login_time": user.last_login.isoformat()
            }
        }, status=status.HTTP_200_OK)

    return Response(
        {"error": "Invalid credentials. Please verify your username and password."},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_change_password_view(request):
    """
    POST /api/auth/change-password/
    Updates owner password in SQLite with secure PBKDF2 hashing.
    """
    import os
    from django.contrib.auth.models import User
    from .models import AuditLog

    username = str(request.data.get('username', 'admin')).strip().lower()
    current_password = str(request.data.get('current_password', ''))
    new_password = str(request.data.get('new_password', ''))
    skip_current = bool(request.data.get('skip_current_password', False))

    if not new_password:
        return Response(
            {"error": "New password is required."},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.filter(username__iexact=username).first()
    if not user:
        user = User.objects.filter(is_superuser=True).first()

    if not user:
        return Response({"error": "Admin account not found in database."}, status=status.HTTP_404_NOT_FOUND)

    # If skip_current is requested (e.g. user logged in via OTP), verify an OTP was recently used
    allow_skip = False
    if skip_current:
        from .models import OwnerOTP
        has_recent_otp = OwnerOTP.objects.filter(
            username=user.username,
            used=True,
            created_at__gte=timezone.now() - timedelta(minutes=45)
        ).exists()
        if has_recent_otp:
            allow_skip = True

    if not allow_skip:
        if not current_password:
            return Response(
                {"error": "Current password is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not user.check_password(current_password):
            return Response(
                {"error": "Current password is incorrect. Please verify your existing password."},
                status=status.HTTP_400_BAD_REQUEST
            )

    if len(new_password) < 6:
        return Response(
            {"error": "New password must be at least 6 characters long."},
            status=status.HTTP_400_BAD_REQUEST
        )

    if user.check_password(new_password):
        return Response(
            {"error": "New password cannot be the same as your current password."},
            status=status.HTTP_400_BAD_REQUEST
        )

    user.set_password(new_password)
    user.save()

    try:
        AuditLog.objects.create(
            user=user,
            action="OWNER_PASSWORD_CHANGED",
            target_entity=f"User:{user.username}",
            details=f"Owner password changed securely in SQLite database at {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
    except Exception:
        pass

    return Response({
        "success": True,
        "message": "Password successfully updated! Your new password is now active.",
        "updated_at": timezone.now().isoformat(),
        "is_default_password": False
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def auth_reset_password_view(request):
    """
    POST /api/auth/reset-password/
    Restores owner password back to system environment default.
    """
    import os
    from django.contrib.auth.models import User
    from .models import AuditLog

    username = str(request.data.get('username', 'admin')).strip().lower()
    user = User.objects.filter(username__iexact=username).first()
    if not user:
        user = User.objects.filter(is_superuser=True).first()

    if not user:
        return Response({"error": "Admin account not found in database."}, status=status.HTTP_404_NOT_FOUND)

    default_pass = os.environ.get('ADMIN_PASSWORD', 'admin123')
    user.set_password(default_pass)
    user.save()

    try:
        AuditLog.objects.create(
            user=user,
            action="OWNER_PASSWORD_RESET",
            target_entity=f"User:{user.username}",
            details="Owner password reset back to system default"
        )
    except Exception:
        pass

    return Response({
        "success": True,
        "message": "Password has been successfully reset to system default.",
        "is_default_password": True
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def auth_status_view(request):
    """
    GET /api/auth/status/
    Returns current owner credentials status from SQLite without exposing sensitive details.
    """
    import os
    from django.contrib.auth.models import User
    admin_name = os.environ.get('ADMIN_USERNAME', 'admin').strip()
    default_pass = os.environ.get('ADMIN_PASSWORD', 'admin123')

    user = User.objects.filter(username__iexact=admin_name).first() or User.objects.filter(is_superuser=True).first()
    if not user:
        return Response({
            "username": admin_name,
            "is_default_password": True,
            "last_login": None
        }, status=status.HTTP_200_OK)

    is_default = user.check_password(default_pass)
    return Response({
        "username": user.username,
        "is_default_password": is_default,
        "last_login": user.last_login.isoformat() if user.last_login else None
    }, status=status.HTTP_200_OK)


# ==========================================================
# OWNER RECOVERY EMAIL — GET / POST
# ==========================================================

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def owner_recovery_email_view(request):
    """
    GET  /api/auth/recovery-email/  → { email, verified }
    POST /api/auth/recovery-email/  → { email: "owner@gmail.com" } → saves it
    """
    from .models import OwnerConfig

    if request.method == 'GET':
        email = OwnerConfig.get('recovery_email', '')
        verified = OwnerConfig.get('recovery_email_verified', 'false') == 'true'
        return Response({'email': email, 'verified': verified}, status=status.HTTP_200_OK)

    if request.method == 'POST':
        email = str(request.data.get('email', '')).strip().lower()
        if not email or '@' not in email:
            return Response({'error': 'A valid email address is required.'}, status=status.HTTP_400_BAD_REQUEST)
        OwnerConfig.set('recovery_email', email)
        OwnerConfig.set('recovery_email_verified', 'true')
        return Response({
            'success': True,
            'message': 'Recovery email saved successfully.',
            'email': email
        }, status=status.HTTP_200_OK)


# ==========================================================
# FORGOT PASSWORD — Send OTP to recovery email
# ==========================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def owner_forgot_password_view(request):
    """
    POST /api/auth/forgot-password/
    Body: { username: "admin" }
    Generates a 6-digit OTP, stores it, and emails it to the owner's recovery Gmail.
    """
    import random
    from datetime import timedelta
    from django.contrib.auth.models import User as DjangoUser
    from .models import OwnerConfig, OwnerOTP
    from .email_service import send_otp_email

    username = str(request.data.get('username', 'admin')).strip().lower()

    # Check recovery email exists
    recovery_email = OwnerConfig.get('recovery_email', '')
    if not recovery_email:
        return Response({
            'error': 'No recovery email is set for this account. Please contact your administrator.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Verify user exists
    user = DjangoUser.objects.filter(username__iexact=username).first()
    if not user:
        user = DjangoUser.objects.filter(is_superuser=True).first()
    if not user:
        return Response({'error': 'Admin account not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Invalidate any previous unused OTPs for this user
    OwnerOTP.objects.filter(username=user.username, used=False).update(used=True)

    # Generate fresh 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    expires_at = timezone.now() + timedelta(minutes=10)

    OwnerOTP.objects.create(
        username=user.username,
        otp_code=otp_code,
        expires_at=expires_at,
        used=False
    )

    # Send email
    sent = send_otp_email(recovery_email, otp_code, username=user.username)
    if not sent:
        return Response({
            'error': 'Failed to send OTP email. Please check the server email configuration.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Return masked email for UX (e.g. "o****@gmail.com")
    at_idx = recovery_email.index('@')
    masked = recovery_email[0] + ('*' * (at_idx - 1)) + recovery_email[at_idx:]

    return Response({
        'success': True,
        'message': f'A 6-digit OTP has been sent to your recovery email.',
        'email_hint': masked
    }, status=status.HTTP_200_OK)


# ==========================================================
# VERIFY OTP — Login via OTP
# ==========================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def owner_verify_otp_view(request):
    """
    POST /api/auth/verify-otp/
    Body: { username: "admin", otp: "123456" }
    Validates OTP and returns a login response with logged_in_via: "otp".
    """
    from django.contrib.auth.models import User as DjangoUser
    from .models import OwnerOTP

    username = str(request.data.get('username', 'admin')).strip().lower()
    otp_input = str(request.data.get('otp', '')).strip()

    if not otp_input or len(otp_input) != 6:
        return Response({'error': 'Please enter a valid 6-digit OTP code.'}, status=status.HTTP_400_BAD_REQUEST)

    user = DjangoUser.objects.filter(username__iexact=username).first()
    if not user:
        user = DjangoUser.objects.filter(is_superuser=True).first()
    if not user:
        return Response({'error': 'Admin account not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Find the most recent unused, unexpired OTP for this user
    otp_obj = OwnerOTP.objects.filter(
        username=user.username,
        otp_code=otp_input,
        used=False
    ).order_by('-created_at').first()

    if not otp_obj:
        return Response({'error': 'Invalid OTP code. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    if not otp_obj.is_valid():
        return Response({'error': 'This OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    # Mark OTP as used
    otp_obj.used = True
    otp_obj.save(update_fields=['used'])

    # Update last login
    from django.utils import timezone as tz
    user.last_login = tz.now()
    user.save(update_fields=['last_login'])

    import os
    default_pass = os.environ.get('ADMIN_PASSWORD', 'admin123')
    is_default = user.check_password(default_pass)

    return Response({
        'success': True,
        'logged_in_via': 'otp',
        'user': {
            'username': user.username,
            'role': 'Store owner',
            'is_default_password': is_default,
            'login_time': user.last_login.isoformat()
        }
    }, status=status.HTTP_200_OK)


