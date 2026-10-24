import io
import csv
from datetime import datetime
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count, Sum, Q
from .models import Machine, LaundrySession
from .services import sync_expired_sessions

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def format_dt(dt, fmt='%Y-%m-%d %H:%M:%S'):
    if not dt:
        return ''
    if timezone.is_aware(dt):
        dt = timezone.localtime(dt)
    return dt.strftime(fmt)

def get_day_wise_analytics(date_str=None, start_date=None, end_date=None):
    """
    Computes KPIs, machine utilization breakdown, and unique people count.
    Supports single date (date_str), date range (start_date to end_date), or all dates.
    """
    sync_expired_sessions()
    sessions = LaundrySession.objects.all().select_related('machine')

    # Available distinct dates for the date picker dropdown
    raw_dates = LaundrySession.objects.dates('started_at', 'day', order='DESC')
    available_dates = [d.strftime('%Y-%m-%d') for d in raw_dates]
    
    # Also ensure today's date is in available dates
    today_str = format_dt(timezone.now(), '%Y-%m-%d')
    if today_str not in available_dates:
        available_dates.insert(0, today_str)

    period_label = 'All Dates Combined'

    # Filter by date range or specific date if requested
    if start_date and end_date:
        try:
            s_d = datetime.strptime(start_date, '%Y-%m-%d').date()
            e_d = datetime.strptime(end_date, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date__gte=s_d, started_at__date__lte=e_d)
            period_label = f"{start_date} to {end_date}"
        except ValueError:
            pass
    elif start_date:
        try:
            s_d = datetime.strptime(start_date, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date__gte=s_d)
            period_label = f"From {start_date}"
        except ValueError:
            pass
    elif date_str and date_str != 'all':
        try:
            selected_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date=selected_date)
            period_label = str(selected_date)
        except ValueError:
            pass

    total_sessions = sessions.count()
    completed_count = sessions.filter(status='completed').count()
    cancelled_count = sessions.filter(status='cancelled').count()
    active_count = sessions.filter(status='active').count()
    
    # Calculate unique customers and total minutes
    unique_customers = sessions.values('customer_email').distinct().count()
    total_minutes = sessions.aggregate(total=Sum('duration_minutes'))['total'] or 0

    # Machine-wise breakdown for the selected period / day
    # We include all active machines + any removed/inactive machines that have sessions!
    all_machines = Machine.objects.all().order_by('machine_code')
    machine_breakdown = []
    seen_codes = set()
    
    for m in all_machines:
        m_sessions = sessions.filter(Q(machine=m) | Q(machine_code=m.machine_code))
        runs_count = m_sessions.count()
        m_unique_people = m_sessions.values('customer_email').distinct().count()
        m_minutes = m_sessions.aggregate(total=Sum('duration_minutes'))['total'] or 0
        machine_status = m.status if m.is_active else 'removed'

        machine_breakdown.append({
            'code': m.machine_code,
            'type': m.machine_type,
            'runs_count': runs_count,
            'unique_people_count': m_unique_people,
            'total_minutes': m_minutes,
            'status': machine_status
        })
        seen_codes.add(m.machine_code)

    # In case there are historical sessions with a machine_code where the Machine object was purged
    orphaned_codes = sessions.exclude(machine_code__in=seen_codes).values_list('machine_code', flat=True).distinct()
    for code in orphaned_codes:
        if not code:
            continue
        m_sessions = sessions.filter(machine_code=code)
        runs_count = m_sessions.count()
        m_unique_people = m_sessions.values('customer_email').distinct().count()
        m_minutes = m_sessions.aggregate(total=Sum('duration_minutes'))['total'] or 0
        m_type = 'dryer' if code.upper().startswith('D') else 'washer'
        machine_breakdown.append({
            'code': code,
            'type': m_type,
            'runs_count': runs_count,
            'unique_people_count': m_unique_people,
            'total_minutes': m_minutes,
            'status': 'removed'
        })

    # Sort machines by runs_count descending
    machine_breakdown.sort(key=lambda x: x['runs_count'], reverse=True)
    most_active_machine = machine_breakdown[0]['code'] if machine_breakdown and machine_breakdown[0]['runs_count'] > 0 else 'N/A'

    return {
        'selected_date': period_label,
        'available_dates': available_dates,
        'summary': {
            'total_sessions': total_sessions,
            'unique_customers': unique_customers,
            'completed_count': completed_count,
            'cancelled_count': cancelled_count,
            'active_count': active_count,
            'total_minutes': total_minutes,
            'most_active_machine': most_active_machine,
        },
        'machine_breakdown': machine_breakdown
    }


def export_sessions_csv(date_str=None, start_date=None, end_date=None, status_filter=None, search_query=None):
    """
    Generates and streams an Excel-compatible CSV file of customer sessions and machine usage.
    Supports single date, date range (start_date to end_date), or all dates.
    """
    sync_expired_sessions()
    sessions = LaundrySession.objects.all().select_related('machine').order_by('-started_at')

    if start_date and end_date:
        try:
            s_d = datetime.strptime(start_date, '%Y-%m-%d').date()
            e_d = datetime.strptime(end_date, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date__gte=s_d, started_at__date__lte=e_d)
            filename_suffix = f"{start_date}_to_{end_date}"
        except ValueError:
            filename_suffix = "range"
    elif start_date:
        try:
            s_d = datetime.strptime(start_date, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date__gte=s_d)
            filename_suffix = f"from_{start_date}"
        except ValueError:
            filename_suffix = "range"
    elif date_str and date_str != 'all':
        try:
            d = datetime.strptime(date_str, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date=d)
            filename_suffix = str(d)
        except ValueError:
            filename_suffix = "date"
    else:
        filename_suffix = "all_time"

    if status_filter and status_filter != 'all':
        sessions = sessions.filter(status=status_filter)

    if search_query:
        from django.db.models import Q
        q = search_query.strip()
        sessions = sessions.filter(
            Q(customer_name__icontains=q) |
            Q(customer_email__icontains=q) |
            Q(customer_phone__icontains=q) |
            Q(machine__machine_code__icontains=q)
        )

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="laundromat_sessions_report_{filename_suffix}.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Session ID',
        'Machine Code',
        'Machine Type',
        'Customer Name',
        'Customer Email',
        'Customer Phone',
        'Duration (Minutes)',
        'Started At (Local)',
        'Completed At (Local)',
        'Status'
    ])

    for s in sessions:
        local_started = format_dt(s.started_at)
        local_completed = format_dt(s.completed_at)
        m_code = s.machine_code or (s.machine.machine_code if s.machine else '')
        m_type = s.machine.machine_type if s.machine else ('dryer' if m_code.upper().startswith('D') else 'washer')
        phone_display = f'="{s.customer_phone}"' if (s.customer_phone and s.customer_phone.strip() and s.customer_phone != 'Not provided') else (s.customer_phone or 'Not provided')
        writer.writerow([
            str(s.id),
            m_code,
            m_type,
            s.customer_name or 'Not specified',
            s.customer_email,
            phone_display,
            s.duration_minutes,
            local_started,
            local_completed,
            s.status.upper()
        ])

    return response


def export_sessions_pdf(date_str=None, start_date=None, end_date=None, status_filter=None, search_query=None):
    """
    Generates a structured, printable PDF usage report with KPI summary, machine utilization, and session logs.
    Supports single date, date range (start_date to end_date), or all dates.
    """
    analytics = get_day_wise_analytics(date_str=date_str, start_date=start_date, end_date=end_date)
    summary = analytics['summary']
    machine_breakdown = analytics['machine_breakdown']

    sessions = LaundrySession.objects.all().select_related('machine').order_by('-started_at')
    
    if start_date and end_date:
        try:
            s_d = datetime.strptime(start_date, '%Y-%m-%d').date()
            e_d = datetime.strptime(end_date, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date__gte=s_d, started_at__date__lte=e_d)
            period_label = f"{start_date} to {end_date}"
            filename_suffix = f"{start_date}_to_{end_date}"
        except ValueError:
            period_label = "Date Range"
            filename_suffix = "range"
    elif start_date:
        try:
            s_d = datetime.strptime(start_date, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date__gte=s_d)
            period_label = f"From {start_date}"
            filename_suffix = f"from_{start_date}"
        except ValueError:
            period_label = "Date Range"
            filename_suffix = "range"
    elif date_str and date_str != 'all':
        try:
            d = datetime.strptime(date_str, '%Y-%m-%d').date()
            sessions = sessions.filter(started_at__date=d)
            period_label = str(d)
            filename_suffix = str(d)
        except ValueError:
            period_label = str(date_str)
            filename_suffix = "date"
    else:
        period_label = "All Historical Records"
        filename_suffix = "all_time"

    if status_filter and status_filter != 'all':
        sessions = sessions.filter(status=status_filter)
    if search_query:
        from django.db.models import Q
        q = search_query.strip()
        sessions = sessions.filter(
            Q(customer_name__icontains=q) |
            Q(customer_email__icontains=q) |
            Q(customer_phone__icontains=q) |
            Q(machine__machine_code__icontains=q)
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'RepTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0B1A44')
    )
    sub_style = ParagraphStyle(
        'RepSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#2558EA')
    )
    meta_style = ParagraphStyle(
        'RepMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B')
    )
    table_text_style = ParagraphStyle(
        'TableText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1E293B')
    )
    table_head_style = ParagraphStyle(
        'TableHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    elements = []

    # Title & Subtitle
    elements.append(Paragraph("Spinzone | Wash Club", title_style))
    elements.append(Paragraph("Official Laundry Session & Machine Usage Report", sub_style))
    
    current_time_str = format_dt(timezone.now(), '%Y-%m-%d %I:%M %p')
    elements.append(Paragraph(f"Report Generated: {current_time_str} | Date Filter: <b>{period_label}</b>", meta_style))
    elements.append(Spacer(1, 14))

    # KPI Summary Table
    elements.append(Paragraph("<b>1. Summary Metrics</b>", sub_style))
    elements.append(Spacer(1, 4))
    
    kpi_data = [
        [
            Paragraph("<b>Total Sessions:</b>", table_text_style), str(summary['total_sessions']),
            Paragraph("<b>Unique People:</b>", table_text_style), str(summary['unique_customers'])
        ],
        [
            Paragraph("<b>Completed Cycles:</b>", table_text_style), str(summary['completed_count']),
            Paragraph("<b>Cancelled Early:</b>", table_text_style), str(summary['cancelled_count'])
        ],
        [
            Paragraph("<b>Active Cycles:</b>", table_text_style), str(summary['active_count']),
            Paragraph("<b>Total Runtime:</b>", table_text_style), f"{summary['total_minutes']} mins"
        ],
        [
            Paragraph("<b>Most Active Machine:</b>", table_text_style), str(summary['most_active_machine']),
            "", ""
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[120, 150, 120, 150])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 14))

    # Machine Breakdown Table
    elements.append(Paragraph("<b>2. Machine Utilization & People Count</b>", sub_style))
    elements.append(Spacer(1, 4))

    mach_data = [[
        Paragraph("Machine Code", table_head_style),
        Paragraph("Type", table_head_style),
        Paragraph("Times Used", table_head_style),
        Paragraph("Unique Customers", table_head_style),
        Paragraph("Total Runtime", table_head_style),
        Paragraph("Current Status", table_head_style),
    ]]
    for m in machine_breakdown:
        mach_data.append([
            Paragraph(m['code'], table_text_style),
            Paragraph(m['type'].title(), table_text_style),
            Paragraph(str(m['runs_count']), table_text_style),
            Paragraph(str(m['unique_people_count']), table_text_style),
            Paragraph(f"{m['total_minutes']} mins", table_text_style),
            Paragraph(m['status'].title(), table_text_style),
        ])

    mach_table = Table(mach_data, colWidths=[80, 80, 85, 110, 95, 90])
    mach_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0B1A44')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F1F5F9')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(mach_table)
    elements.append(Spacer(1, 14))

    # Detailed Sessions Table
    elements.append(Paragraph("<b>3. Detailed Customer Sessions Log</b>", sub_style))
    elements.append(Spacer(1, 4))

    sess_data = [[
        Paragraph("Customer", table_head_style),
        Paragraph("Contact", table_head_style),
        Paragraph("Machine", table_head_style),
        Paragraph("Duration", table_head_style),
        Paragraph("Started (Local)", table_head_style),
        Paragraph("Status", table_head_style),
    ]]

    for s in sessions[:50]:  # Cap at top 50 rows for clean PDF layout
        started_str = format_dt(s.started_at, '%m/%d %I:%M %p') if s.started_at else '-'
        contact_str = f"{s.customer_email}<br/>{s.customer_phone or 'No phone'}"
        status_color = '#10B981' if s.status == 'completed' else '#EF4444' if s.status == 'cancelled' else '#2558EA'
        status_html = f"<font color='{status_color}'><b>{s.status.upper()}</b></font>"

        m_code = s.machine_code or (s.machine.machine_code if s.machine else '-')
        sess_data.append([
            Paragraph(s.customer_name or 'Walk-in Customer', table_text_style),
            Paragraph(contact_str, table_text_style),
            Paragraph(m_code, table_text_style),
            Paragraph(f"{s.duration_minutes} min", table_text_style),
            Paragraph(started_str, table_text_style),
            Paragraph(status_html, table_text_style),
        ])

    sess_table = Table(sess_data, colWidths=[105, 155, 60, 60, 95, 65])
    sess_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2558EA')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(sess_table)

    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="laundromat_report_{filename_suffix}.pdf"'
    return response
