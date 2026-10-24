import io
from datetime import datetime, timedelta, time
from django.utils import timezone
from django.db.models import Count, Sum, Q
from .models import Machine, LaundrySession
from .services import sync_expired_sessions


def format_minutes_to_hours_mins(minutes):
    if not minutes:
        return "0h 00m"
    hours = int(minutes) // 60
    mins = int(minutes) % 60
    return f"{hours}h {mins:02d}m"


def get_activity_analytics(period='week', start_date=None, end_date=None, machine_filter='all', customer_filter='all'):
    """
    Computes real-time, database-driven usage analytics for owner decision making:
    - Real-time Day, Week, Month, and Custom scale metrics from LaundrySession & Machine models
    - Real customer arrival 2-hour heatmap by day of week
    - Real unit-by-unit machine runtime, idle time, and utilization %
    - Real Wash vs. Dry volume & active time utilization
    - Dynamic data-driven insights for business optimization
    """
    # 1. Ensure expired sessions are synced to database before computing
    sync_expired_sessions()

    # Get local current time
    now = timezone.localtime(timezone.now()) if timezone.is_aware(timezone.now()) else timezone.now()
    today = now.date()

    # 2. Determine date bounds based on period
    if period == 'day':
        s_date = today
        e_date = today
        selected_label = today.strftime('%a, %d %b %Y')
    elif period == 'month':
        s_date = today - timedelta(days=29)
        e_date = today
        selected_label = f"{s_date.strftime('%d %b')}–{e_date.strftime('%d %b %Y')} · 30 days"
    elif period == 'custom' and start_date:
        try:
            s_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            e_date = datetime.strptime(end_date, '%Y-%m-%d').date() if end_date else today
            selected_label = f"{s_date.strftime('%d %b %Y')} – {e_date.strftime('%d %b %Y')}"
        except ValueError:
            s_date = today - timedelta(days=6)
            e_date = today
            selected_label = f"{s_date.strftime('%d')}–{e_date.strftime('%d %b %Y')}"
    else:  # default 'week'
        period = 'week'
        s_date = today - timedelta(days=6)
        e_date = today
        selected_label = f"{s_date.strftime('%d')}–{e_date.strftime('%d %b %Y')}"

    days_in_period = max((e_date - s_date).days + 1, 1)

    # 3. Base Queryset for the period
    base_sessions = LaundrySession.objects.filter(
        started_at__date__gte=s_date,
        started_at__date__lte=e_date
    ).select_related('machine')

    # Apply Machine Filter
    filtered_sessions = base_sessions
    if machine_filter == 'washers':
        filtered_sessions = filtered_sessions.filter(
            Q(machine__machine_type='washer') | Q(machine_code__istartswith='w')
        )
    elif machine_filter == 'dryers':
        filtered_sessions = filtered_sessions.filter(
            Q(machine__machine_type='dryer') | Q(machine_code__istartswith='d')
        )
    elif machine_filter != 'all':
        filtered_sessions = filtered_sessions.filter(machine_code__iexact=machine_filter)

    # Apply Customer Filter
    if customer_filter == 'repeat':
        repeat_emails = (
            LaundrySession.objects.values('customer_email')
            .annotate(c=Count('id'))
            .filter(c__gt=1)
            .values_list('customer_email', flat=True)
        )
        filtered_sessions = filtered_sessions.filter(customer_email__in=repeat_emails)
    elif customer_filter == 'first_time':
        single_emails = (
            LaundrySession.objects.values('customer_email')
            .annotate(c=Count('id'))
            .filter(c=1)
            .values_list('customer_email', flat=True)
        )
        filtered_sessions = filtered_sessions.filter(customer_email__in=single_emails)

    completed_sessions = filtered_sessions.filter(status='completed')

    # 4. Fetch All Active Machines from DB
    all_machines = Machine.objects.filter(is_active=True).order_by('machine_code')
    total_machine_count = all_machines.count() or 8
    washers_count = all_machines.filter(machine_type='washer').count()
    dryers_count = all_machines.filter(machine_type='dryer').count()

    # Operating hours: 6 AM to 8 PM = 14 hours / day = 840 mins / day per machine
    HOURS_PER_DAY = 14
    TOTAL_AVAIL_MINUTES_PER_UNIT = HOURS_PER_DAY * 60 * days_in_period
    TOTAL_STORE_AVAIL_MINUTES = total_machine_count * TOTAL_AVAIL_MINUTES_PER_UNIT

    # 5. Top KPI Card Metrics
    unique_customers_count = filtered_sessions.values('customer_email').distinct().count()
    completed_cycles_count = completed_sessions.count()

    completed_washers = completed_sessions.filter(
        Q(machine__machine_type='washer') | Q(machine_code__istartswith='w')
    ).count()
    completed_dryers = completed_sessions.filter(
        Q(machine__machine_type='dryer') | Q(machine_code__istartswith='d')
    ).count()

    total_active_minutes = completed_sessions.aggregate(total=Sum('duration_minutes'))['total'] or 0
    # Also add active in-progress session runtime
    in_progress_sessions = filtered_sessions.filter(status='active')
    for act in in_progress_sessions:
        if act.started_at:
            elapsed = (now - act.started_at).total_seconds() / 60
            total_active_minutes += min(int(elapsed), act.duration_minutes)

    overall_utilization_pct = round(
        (total_active_minutes / TOTAL_STORE_AVAIL_MINUTES) * 100, 1
    ) if TOTAL_STORE_AVAIL_MINUTES > 0 else 0.0

    active_time_str = format_minutes_to_hours_mins(total_active_minutes)
    total_avail_hours = (total_machine_count * HOURS_PER_DAY * days_in_period)
    avail_time_str = f"{total_avail_hours}h available"

    # Compute Busiest 2-Hour Window & Busiest Day
    time_slot_counts = {
        '6–8 AM': 0, '8–10 AM': 0, '10–12 PM': 0,
        '12–2 PM': 0, '2–4 PM': 0, '4–6 PM': 0, '6–8 PM': 0
    }
    day_name_counts = {
        'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
        'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0
    }

    for s in filtered_sessions:
        dt = timezone.localtime(s.started_at) if timezone.is_aware(s.started_at) else s.started_at
        h = dt.hour
        day_full = dt.strftime('%A')
        if day_full in day_name_counts:
            day_name_counts[day_full] += 1

        if 6 <= h < 8:
            time_slot_counts['6–8 AM'] += 1
        elif 8 <= h < 10:
            time_slot_counts['8–10 AM'] += 1
        elif 10 <= h < 12:
            time_slot_counts['10–12 PM'] += 1
        elif 12 <= h < 14:
            time_slot_counts['12–2 PM'] += 1
        elif 14 <= h < 16:
            time_slot_counts['2–4 PM'] += 1
        elif 16 <= h < 18:
            time_slot_counts['4–6 PM'] += 1
        else:
            time_slot_counts['6–8 PM'] += 1

    busiest_slot = max(time_slot_counts, key=time_slot_counts.get) if any(time_slot_counts.values()) else "12–2 PM"
    busiest_day = max(day_name_counts, key=day_name_counts.get) if any(day_name_counts.values()) else "Wednesday"
    busiest_slot_short = busiest_slot.replace(' AM', '').replace(' PM', ' PM')

    # Subtexts for Top Cards
    if period == 'day':
        cust_sub = "Unique visitors today"
    elif period == 'month':
        cust_sub = "Unique visitors this month"
    else:
        cust_sub = "Unique visitors this week"

    top_metrics = {
        "customers": unique_customers_count,
        "customers_sub": cust_sub,
        "completed_cycles": completed_cycles_count,
        "completed_cycles_sub": f"{completed_washers} wash · {completed_dryers} dry",
        "utilization": f"{overall_utilization_pct}%",
        "utilization_sub": f"{active_time_str} active / {avail_time_str}",
        "busiest_window": busiest_slot_short,
        "busiest_window_sub": f"{busiest_day} is the busiest day"
    }

    # 6. "Your usage, at every scale" (DAY, WEEK, MONTH calculations)
    # Scale A: DAY (Today's metrics)
    day_sessions = LaundrySession.objects.filter(started_at__date=today)
    day_completed = day_sessions.filter(status='completed')
    day_cust = day_sessions.values('customer_email').distinct().count()
    day_cycles = day_completed.count()
    day_active_mins = day_completed.aggregate(total=Sum('duration_minutes'))['total'] or 0
    day_avail_mins = total_machine_count * HOURS_PER_DAY * 60
    day_util = round((day_active_mins / day_avail_mins) * 100, 1) if day_avail_mins > 0 else 0.0

    day_bars_data = [
        {"label": "6a", "hour_range": (6, 8)},
        {"label": "8a", "hour_range": (8, 10)},
        {"label": "10a", "hour_range": (10, 12)},
        {"label": "12p", "hour_range": (12, 14)},
        {"label": "2p", "hour_range": (14, 16)},
        {"label": "4p", "hour_range": (16, 18)},
        {"label": "6p", "hour_range": (18, 24)}
    ]
    for b in day_bars_data:
        hr_min, hr_max = b["hour_range"]
        cnt = day_completed.filter(started_at__hour__gte=hr_min, started_at__hour__lt=hr_max).count()
        b["value"] = cnt
    max_day_bar = max([b["value"] for b in day_bars_data] or [1]) or 1
    for b in day_bars_data:
        b["pct"] = round((b["value"] / max_day_bar) * 100) if max_day_bar > 0 else 10

    # Scale B: WEEK (Last 7 Days)
    w_start = today - timedelta(days=6)
    week_sessions = LaundrySession.objects.filter(started_at__date__gte=w_start, started_at__date__lte=today)
    week_completed = week_sessions.filter(status='completed')
    week_cust = week_sessions.values('customer_email').distinct().count()
    week_cycles = week_completed.count()
    week_active_mins = week_completed.aggregate(total=Sum('duration_minutes'))['total'] or 0
    week_avail_mins = total_machine_count * HOURS_PER_DAY * 60 * 7
    week_util = round((week_active_mins / week_avail_mins) * 100, 1) if week_avail_mins > 0 else 0.0

    week_bars_data = []
    # 7 days from w_start to today
    for i in range(7):
        curr_d = w_start + timedelta(days=i)
        d_label = curr_d.strftime('%a')[0]  # M, T, W, T, F, S, S
        cnt = week_completed.filter(started_at__date=curr_d).count()
        week_bars_data.append({"label": d_label, "value": cnt, "date": curr_d.strftime('%Y-%m-%d')})
    max_week_bar = max([b["value"] for b in week_bars_data] or [1]) or 1
    for b in week_bars_data:
        b["pct"] = round((b["value"] / max_week_bar) * 100) if max_week_bar > 0 else 10

    # Scale C: MONTH (Last 30 Days)
    m_start = today - timedelta(days=29)
    month_sessions = LaundrySession.objects.filter(started_at__date__gte=m_start, started_at__date__lte=today)
    month_completed = month_sessions.filter(status='completed')
    month_cust = month_sessions.values('customer_email').distinct().count()
    month_cycles = month_completed.count()
    month_active_mins = month_completed.aggregate(total=Sum('duration_minutes'))['total'] or 0
    month_avail_mins = total_machine_count * HOURS_PER_DAY * 60 * 30
    month_util = round((month_active_mins / month_avail_mins) * 100, 1) if month_avail_mins > 0 else 0.0

    # 5 intervals of 6 days each
    month_bars_data = [
        {"label": "1–7", "days": (0, 7)},
        {"label": "8–14", "days": (7, 14)},
        {"label": "15–21", "days": (14, 21)},
        {"label": "22–28", "days": (21, 28)},
        {"label": "29–30", "days": (28, 30)}
    ]
    for mb in month_bars_data:
        d_from, d_to = mb["days"]
        bin_start = m_start + timedelta(days=d_from)
        bin_end = min(m_start + timedelta(days=d_to - 1), today)
        cnt = month_completed.filter(started_at__date__gte=bin_start, started_at__date__lte=bin_end).count()
        mb["value"] = cnt
    max_month_bar = max([b["value"] for b in month_bars_data] or [1]) or 1
    for mb in month_bars_data:
        mb["pct"] = round((mb["value"] / max_month_bar) * 100) if max_month_bar > 0 else 10

    scales = {
        "day": {
            "tag": "DAY",
            "label": today.strftime('%a, %d %b'),
            "customers": day_cust,
            "cycles": day_cycles,
            "utilization": f"{day_util}%",
            "chart_title": "Cycles by two-hour window",
            "bars": day_bars_data
        },
        "week": {
            "tag": "WEEK",
            "label": f"{w_start.strftime('%d')}–{today.strftime('%d %b')}",
            "customers": week_cust,
            "cycles": week_cycles,
            "utilization": f"{week_util}%",
            "chart_title": "Completed cycles by day",
            "bars": week_bars_data
        },
        "month": {
            "tag": "MONTH",
            "label": f"{m_start.strftime('%d %b')}–{today.strftime('%d %b')} · 30 days",
            "customers": f"{month_cust:,}",
            "cycles": f"{month_cycles:,}",
            "utilization": f"{month_util}%",
            "chart_title": "Completed cycles · days in 30-day period",
            "bars": month_bars_data
        }
    }

    # 7. Customer Arrivals Heatmap Matrix (7 days x 7 slots)
    time_slots = ["6–8a", "8–10a", "10–12p", "12–2p", "2–4p", "4–6p", "6–8p"]
    day_rows_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    heatmap_matrix = {d: [0] * 7 for d in day_rows_order}

    # "Customer arrivals · one customer counted at first visit each day"
    # To be strictly accurate to definition: group by customer_email + started_at__date
    distinct_visits = (
        filtered_sessions.order_by('customer_email', 'started_at')
    )
    seen_customer_day = set()
    for s in distinct_visits:
        dt = timezone.localtime(s.started_at) if timezone.is_aware(s.started_at) else s.started_at
        c_day_key = f"{s.customer_email}_{dt.date()}"
        if c_day_key in seen_customer_day:
            continue
        seen_customer_day.add(c_day_key)

        d_str = dt.strftime('%a')
        h = dt.hour
        if h < 8:
            slot_idx = 0
        elif h < 10:
            slot_idx = 1
        elif h < 12:
            slot_idx = 2
        elif h < 14:
            slot_idx = 3
        elif h < 16:
            slot_idx = 4
        elif h < 18:
            slot_idx = 5
        else:
            slot_idx = 6

        if d_str in heatmap_matrix:
            heatmap_matrix[d_str][slot_idx] += 1

    heatmap_rows = []
    for d in day_rows_order:
        slots = heatmap_matrix[d]
        heatmap_rows.append({
            "day": d,
            "slots": slots,
            "total": sum(slots)
        })

    # 8. Machine Unit Level Breakdown Table
    units_list = []
    for m in all_machines:
        m_sessions = completed_sessions.filter(Q(machine=m) | Q(machine_code=m.machine_code))
        m_cycles = m_sessions.count()
        m_active_mins = m_sessions.aggregate(total=Sum('duration_minutes'))['total'] or 0
        
        # Available minutes for this single machine in period
        m_avail_mins = TOTAL_AVAIL_MINUTES_PER_UNIT
        m_idle_mins = max(m_avail_mins - m_active_mins, 0)
        m_util_pct = round((m_active_mins / m_avail_mins) * 100, 1) if m_avail_mins > 0 else 0.0

        units_list.append({
            "code": m.machine_code,
            "type": "Washer" if m.machine_type == 'washer' else "Dryer",
            "cycles": m_cycles,
            "active_time": format_minutes_to_hours_mins(m_active_mins),
            "utilization": m_util_pct,
            "idle_time": format_minutes_to_hours_mins(m_idle_mins),
            "active_mins_raw": m_active_mins
        })

    # Sort units so highest cycle machines appear first (matching Spinwise pattern)
    units_list.sort(key=lambda u: (u["type"] != "Washer", -u["cycles"], u["code"]))

    # 9. Wash vs. Dry Distribution & Utilization by Type
    total_completed = completed_cycles_count or 1
    washers_share_pct = round((completed_washers / total_completed) * 100, 1) if completed_cycles_count > 0 else 0.0
    dryers_share_pct = round((completed_dryers / total_completed) * 100, 1) if completed_cycles_count > 0 else 0.0

    washer_total_active_mins = sum(u["active_mins_raw"] for u in units_list if u["type"] == "Washer")
    dryer_total_active_mins = sum(u["active_mins_raw"] for u in units_list if u["type"] == "Dryer")

    washer_total_avail_mins = max(washers_count * TOTAL_AVAIL_MINUTES_PER_UNIT, 1)
    dryer_total_avail_mins = max(dryers_count * TOTAL_AVAIL_MINUTES_PER_UNIT, 1)

    washers_util_type_pct = round((washer_total_active_mins / washer_total_avail_mins) * 100, 1)
    dryers_util_type_pct = round((dryer_total_active_mins / dryer_total_avail_mins) * 100, 1)

    # Idle time calculation for entire store
    store_idle_minutes = max(TOTAL_STORE_AVAIL_MINUTES - total_active_minutes, 0)
    store_idle_str = format_minutes_to_hours_mins(store_idle_minutes)

    # 10. Intelligent Real-Time Insights Generation
    top_machine = units_list[0]["code"] if units_list else "W-1"
    top_machine_cycles = units_list[0]["cycles"] if units_list else 0

    insights = [
        f"{busiest_day} leads customer demand with {day_name_counts.get(busiest_day, 0)} sessions.",
        f"Washers account for {washers_share_pct}% of completed runs ({completed_washers} wash vs {completed_dryers} dry).",
        f"{busiest_slot_short} is the arrival peak ({time_slot_counts.get(busiest_slot, 0)} visits logged)."
    ]

    # Available machine codes list for frontend filter dropdown
    machine_options = [{"code": m.machine_code, "type": m.machine_type} for m in all_machines]

    return {
        "period": period,
        "selected_label": selected_label,
        "operating_hours": "Mon–Sun · Open 6 AM–8 PM",
        "is_realtime": True,
        "top_metrics": top_metrics,
        "scales": scales,
        "heatmap": {
            "period_label": selected_label,
            "time_slots": time_slots,
            "rows": heatmap_rows
        },
        "time_usage": {
            "sub_title": f"All {total_machine_count} machines · selected {period}",
            "formula": "Utilization = active time ÷ available machine time",
            "formula_sub": f"Available: {total_machine_count} machines × {HOURS_PER_DAY} hours × {days_in_period} days = {total_avail_hours} hours",
            "utilization_pct": overall_utilization_pct,
            "active_time": active_time_str,
            "idle_time": store_idle_str
        },
        "machine_view": {
            "sub_title": f"Usage by unit · selected {period}",
            "summary_pills": [f"{washers_count} washers", f"{dryers_count} dryers"],
            "footer_note": f"Each unit: {HOURS_PER_DAY * days_in_period} available hours in period. Active time uses cycle runtime.",
            "units": units_list
        },
        "wash_vs_dry": {
            "total_cycles": completed_cycles_count,
            "washers": {"cycles": completed_washers, "pct": washers_share_pct},
            "dryers": {"cycles": completed_dryers, "pct": dryers_share_pct},
            "utilization_by_type": {
                "washers_pct": washers_util_type_pct,
                "dryers_pct": dryers_util_type_pct
            }
        },
        "glance_insights": insights,
        "available_machines": machine_options
    }
