import logging
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def send_cycle_completed_email(session):
    """
    Sends a beautifully formatted completion notification email to the customer
    when their wash or dry cycle completes.
    
    Dynamically customizes the email for:
    - Washer (W-1, W-2, etc.): advises collecting clothes or transferring to a dryer
    - Dryer  (D-1, D-2, etc.): advises collecting warm, dry clothes
    
    Protections:
    - Idempotent: checks session.email_sent to never send duplicate emails.
    - Filters out internal placeholder emails (e.g. walkin-*@laundromat.local).
    - Wrapped in try/except so email delivery failures never break API transactions.
    """
    if not session:
        return False

    # 1. Guard against duplicate sending
    if session.email_sent:
        logger.info(f"Email already sent for session {session.id}, skipping.")
        return False

    # 2. Check if email is valid and not an internal walk-in placeholder
    customer_email = (session.customer_email or '').strip()
    if not customer_email or customer_email.endswith('@laundromat.local') or '@' not in customer_email:
        logger.info(f"Skipping email for session {session.id}: non-deliverable email '{customer_email}'.")
        return False

    # 3. Determine machine type and customize messaging
    machine_code = session.machine_code or (session.machine.machine_code if session.machine else 'Machine')
    m_code_upper = machine_code.upper()
    
    is_dryer = False
    if session.machine and session.machine.machine_type == 'dryer':
        is_dryer = True
    elif m_code_upper.startswith('D'):
        is_dryer = True

    customer_name = session.customer_name.strip() if session.customer_name else 'Alex'
    duration = session.duration_minutes or 40

    if is_dryer:
        machine_label = f"Dryer {machine_code}"
        subject = f"✨ Your laundry on Dryer {machine_code} is dry & ready! — Spinzone"
        headline = "Dry & Fresh. Ready to Go."
        subheadline = f"{customer_name}, your drying cycle is complete!"
        action_text = f"Your clothes in <strong>Dryer {machine_code}</strong> are warm, dry, and ready for pickup. Please collect your laundry promptly so the machine is available for other customers."
        service_badge = "DRYING CYCLE COMPLETE"
        badge_color = "#EA580C" # Warm orange for dryer
        next_step_tip = "🧺 Grab your laundry bag and collect your clothes from machine " + machine_code + "."
    else:
        machine_label = f"Washer {machine_code}"
        subject = f"🧺 Your wash on Washer {machine_code} is finished! — Spinzone"
        headline = "Clean & Fresh. Ready to Unload."
        subheadline = f"{customer_name}, your wash cycle is complete!"
        action_text = f"Your wash in <strong>Washer {machine_code}</strong> has finished. Please unload your clothes promptly to transfer them to a dryer or head home."
        service_badge = "WASH CYCLE COMPLETE"
        badge_color = "#2558EA" # Brand blue for washer
        next_step_tip = "✨ Transfer your clothes to a dryer (like D-1 or D-2) for fresh, warm laundry!"

    # 4. Generate Plaintext Fallback
    text_message = f"""
Hello {customer_name},

{headline}
{subheadline}

{action_text.replace('<strong>', '').replace('</strong>', '')}

SESSION SUMMARY:
- Machine: {machine_label}
- Duration: {duration} minutes
- Status: Completed
- Next Step: {next_step_tip}

Thank you for washing with Spinzone Laundromat!
A little less waiting. A little more you.
""".strip()

    # 5. Generate Responsive HTML Email
    html_message = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
    }}
    .email-container {{
      max-width: 560px;
      margin: 32px auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #E2E8F0;
    }}
    .header {{
      background: linear-gradient(135deg, #0A1128 0%, #1C2D5A 100%);
      padding: 32px 28px;
      text-align: center;
      color: #FFFFFF;
    }}
    .brand-pill {{
      display: inline-block;
      padding: 4px 14px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #93C5FD;
      margin-bottom: 12px;
    }}
    .brand-title {{
      font-size: 26px;
      font-weight: 800;
      margin: 0;
      color: #FFFFFF;
      letter-spacing: -0.5px;
    }}
    .content {{
      padding: 32px 28px;
    }}
    .badge {{
      display: inline-block;
      padding: 6px 14px;
      background-color: {badge_color};
      color: #FFFFFF;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }}
    .headline {{
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #0F172A;
      line-height: 1.3;
    }}
    .subheadline {{
      font-size: 15px;
      color: #475569;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }}
    .action-card {{
      background-color: #F1F5F9;
      border-left: 4px solid {badge_color};
      padding: 16px 18px;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      color: #1E293B;
      line-height: 1.6;
      margin-bottom: 24px;
    }}
    .details-table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }}
    .details-table td {{
      padding: 12px 14px;
      font-size: 14px;
      border-bottom: 1px solid #E2E8F0;
    }}
    .details-label {{
      color: #64748B;
      font-weight: 500;
      width: 40%;
    }}
    .details-value {{
      color: #0F172A;
      font-weight: 600;
      text-align: right;
    }}
    .tip-box {{
      background: #EFF6FF;
      border: 1px dashed #93C5FD;
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 13px;
      color: #1E40AF;
      margin-bottom: 28px;
    }}
    .footer {{
      background-color: #F8FAFC;
      padding: 20px 28px;
      text-align: center;
      border-top: 1px solid #E2E8F0;
      font-size: 12px;
      color: #94A3B8;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand-pill">Spinzone Laundromat</div>
      <h1 class="brand-title">Cycle Complete</h1>
    </div>

    <div class="content">
      <div class="badge">{service_badge}</div>
      <h2 class="headline">{headline}</h2>
      <p class="subheadline">{action_text}</p>

      <table class="details-table">
        <tr>
          <td class="details-label">Machine</td>
          <td class="details-value">{machine_label}</td>
        </tr>
        <tr>
          <td class="details-label">Customer</td>
          <td class="details-value">{customer_name}</td>
        </tr>
        <tr>
          <td class="details-label">Duration</td>
          <td class="details-value">{duration} minutes</td>
        </tr>
        <tr>
          <td class="details-label">Status</td>
          <td class="details-value" style="color: #16A34A;">Completed</td>
        </tr>
      </table>

      <div class="tip-box">
        <strong>💡 Next Step:</strong> {next_step_tip}
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>Spinzone Laundromat</strong></p>
      <p style="margin: 0 0 8px 0;">A little less waiting. A little more you.</p>
      <p style="margin: 0; font-size: 11px; color: #94A3B8;">Powered by <strong>SanielSoft</strong></p>
    </div>
  </div>
</body>
</html>
""".strip()

    # 6. Send email via Django's mail system
    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Spinzone <noreply@spinzone.local>')
        send_mail(
            subject=subject,
            message=text_message,
            from_email=from_email,
            recipient_list=[customer_email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"✅ Notification email successfully sent to {customer_email} for machine {machine_code}.")

        # Mark as sent in database to prevent duplicates
        session.email_sent = True
        session.save(update_fields=['email_sent'])

        # Record in Notification audit table (Section 7 specification)
        try:
            from .models import Notification, AuditLog
            Notification.objects.update_or_create(
                session=session,
                defaults={'channel': 'email', 'status': 'sent', 'sent_at': timezone.now(), 'error_message': None}
            )
            AuditLog.objects.create(
                action='NOTIFICATION_SENT',
                record_type='LaundrySession',
                record_id=str(session.id),
                change_details=f"Email notification sent to {customer_email} for machine {machine_code}."
            )
        except Exception as notif_err:
            logger.warning(f"Could not update Notification/Audit table: {notif_err}")

        return True
    except Exception as e:
        logger.error(f"❌ Failed to send cycle completed email for session {session.id}: {e}", exc_info=True)
        try:
            from .models import Notification
            Notification.objects.update_or_create(
                session=session,
                defaults={'channel': 'email', 'status': 'failed', 'error_message': str(e)}
            )
        except Exception:
            pass
        return False


def send_cycle_reminder_email(session):
    """
    Sends a 5-minute pre-completion warning notification email to the customer
    so they have plenty of time to head back to the machine before it completes.

    Protections:
    - Idempotent: checks session.reminder_email_sent to never send duplicate reminder emails.
    - Filters out internal placeholder emails (e.g. walkin-*@laundromat.local).
    - Wrapped in try/except so email delivery failures never break background tasks.
    """
    if not session:
        return False

    # 1. Guard against duplicate sending
    if session.reminder_email_sent:
        logger.info(f"5-min reminder already sent for session {session.id}, skipping.")
        return False

    # 2. Check if email is valid and not an internal walk-in placeholder
    customer_email = (session.customer_email or '').strip()
    if not customer_email or customer_email.endswith('@laundromat.local') or '@' not in customer_email:
        logger.info(f"Skipping 5-min reminder for session {session.id}: non-deliverable email '{customer_email}'.")
        return False

    # 3. Determine machine type and customize messaging
    machine_code = session.machine_code or (session.machine.machine_code if session.machine else 'Machine')
    m_code_upper = machine_code.upper()

    is_dryer = False
    if session.machine and session.machine.machine_type == 'dryer':
        is_dryer = True
    elif m_code_upper.startswith('D'):
        is_dryer = True

    customer_name = session.customer_name.strip() if session.customer_name else 'Alex'
    duration = session.duration_minutes or 40

    if is_dryer:
        machine_label = f"Dryer {machine_code}"
        subject = f"⏰ ~5 mins left on Dryer {machine_code}! — Spinzone"
        headline = "Almost Dry. 5 Minutes Left."
        subheadline = f"{customer_name}, your drying cycle is in its final 5 minutes!"
        action_text = f"Your clothes in <strong>Dryer {machine_code}</strong> will be done in approximately 5 minutes. Time to head over with your laundry basket so you can collect them warm and wrinkle-free!"
        service_badge = "⏰ 5 MINUTES REMAINING"
        badge_color = "#EA580C"
        next_step_tip = f"🧺 Grab your basket and head back to Dryer {machine_code} to collect your fresh, warm laundry right on time."
    else:
        machine_label = f"Washer {machine_code}"
        subject = f"⏰ ~5 mins left on Washer {machine_code}! — Spinzone"
        headline = "Almost Done. 5 Minutes Left."
        subheadline = f"{customer_name}, your washing cycle is in its final 5 minutes!"
        action_text = f"Your clothes in <strong>Washer {machine_code}</strong> will be ready in approximately 5 minutes. Please head back to collect your clean clothes promptly or transfer them to a dryer."
        service_badge = "⏰ 5 MINUTES REMAINING"
        badge_color = "#2563EB"
        next_step_tip = f"🧺 Head back to Washer {machine_code}. You can also check our live floor status if you'd like to transfer straight to an empty dryer!"

    # 4. Plain text fallback version
    text_message = f"""
Spinzone Laundromat — 5-Minute Heads-Up
---------------------------------------
Hello {customer_name},

Your {machine_label} cycle has approximately 5 minutes remaining!

Machine: {machine_label}
Cycle Duration: {duration} mins
Status: Almost Done (~5 mins left)

Tip: {next_step_tip}

Thank you for choosing Spinzone Laundromat!
Powered by SanielSoft
""".strip()

    # 5. HTML version matching Spinzone design
    html_message = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
    }}
    .email-container {{
      max-width: 580px;
      margin: 24px auto;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(11, 26, 68, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #0B1A44 0%, #172554 100%);
      color: #FFFFFF;
      padding: 32px 28px 26px 28px;
      text-align: center;
    }}
    .brand-pill {{
      display: inline-block;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #93C5FD;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 12px;
      margin-bottom: 12px;
    }}
    .header h1 {{
      margin: 0 0 6px 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }}
    .header p {{
      margin: 0;
      font-size: 14px;
      color: #CBD5E1;
    }}
    .content {{
      padding: 30px 28px;
    }}
    .status-badge-wrap {{
      text-align: center;
      margin-bottom: 22px;
    }}
    .status-badge {{
      display: inline-block;
      background-color: #FEF3C7;
      color: #B45309;
      border: 1px solid #FCD34D;
      padding: 7px 18px;
      border-radius: 20px;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }}
    .action-callout {{
      background: #F8FAFC;
      border-left: 4px solid {badge_color};
      padding: 16px 18px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.55;
      color: #334155;
    }}
    .details-table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13.5px;
    }}
    .details-table td {{
      padding: 10px 12px;
      border-bottom: 1px solid #F1F5F9;
    }}
    .details-label {{
      color: #64748B;
      font-weight: 600;
      width: 40%;
    }}
    .details-value {{
      color: #0F172A;
      font-weight: 700;
      text-align: right;
    }}
    .tip-box {{
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      color: #166534;
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.5;
    }}
    .footer {{
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      padding: 22px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748B;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="brand-pill">Spinzone Laundromat</div>
      <h1>{headline}</h1>
      <p>{subheadline}</p>
    </div>

    <div class="content">
      <div class="status-badge-wrap">
        <span class="status-badge">{service_badge}</span>
      </div>

      <div class="action-callout">
        {action_text}
      </div>

      <table class="details-table">
        <tr>
          <td class="details-label">Machine Assigned</td>
          <td class="details-value">{machine_label}</td>
        </tr>
        <tr>
          <td class="details-label">Total Duration</td>
          <td class="details-value">{duration} minutes</td>
        </tr>
        <tr>
          <td class="details-label">Status</td>
          <td class="details-value" style="color: #D97706;">Final 5 Minutes</td>
        </tr>
      </table>

      <div class="tip-box">
        <strong>💡 Next Step:</strong> {next_step_tip}
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>Spinzone Laundromat</strong></p>
      <p style="margin: 0 0 8px 0;">A little less waiting. A little more you.</p>
      <p style="margin: 0; font-size: 11px; color: #94A3B8;">Powered by <strong>SanielSoft</strong></p>
    </div>
  </div>
</body>
</html>
""".strip()

    # 6. Send email via Django's mail system
    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Spinzone <noreply@spinzone.local>')
        send_mail(
            subject=subject,
            message=text_message,
            from_email=from_email,
            recipient_list=[customer_email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"✅ 5-min reminder email successfully sent to {customer_email} for machine {machine_code}.")

        # Mark reminder as sent in database to guarantee no duplicates
        session.reminder_email_sent = True
        session.save(update_fields=['reminder_email_sent'])

        try:
            from .models import AuditLog
            AuditLog.objects.create(
                action='NOTIFICATION_SENT',
                record_type='LaundrySession',
                record_id=str(session.id),
                change_details=f"5-minute reminder email sent to {customer_email} for machine {machine_code}."
            )
        except Exception:
            pass

        return True
    except Exception as e:
        logger.error(f"❌ Failed to send 5-min reminder email for session {session.id}: {e}", exc_info=True)
        return False
