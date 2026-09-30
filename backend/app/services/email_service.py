import os
import smtplib
import ssl
from email.message import EmailMessage
from html import escape

from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def send_loan_email(
    recipient_email: str,
    person_name: str,
    device_name: str,
    device_code: str,
    loan_id: int,
) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user
    smtp_use_tls = _env_bool("SMTP_USE_TLS", True)
    smtp_use_ssl = _env_bool("SMTP_USE_SSL", False)

    if not smtp_host:
        raise RuntimeError("SMTP_HOST is not configured")

    if not smtp_from:
        raise RuntimeError("SMTP_FROM or SMTP_USER must be configured")

    if smtp_user and smtp_password and not (smtp_use_tls or smtp_use_ssl):
        raise RuntimeError("SMTP authentication requires TLS or SSL")

    if not recipient_email or not recipient_email.strip():
        raise RuntimeError("Recipient email is empty")

    message = EmailMessage()
    message["Subject"] = f"Confirmare imprumut - {device_code}"
    message["From"] = smtp_from
    message["To"] = recipient_email.strip()

    message.set_content(
        f"""Buna, {person_name}!

A fost inregistrat un imprumut pe numele tau.

Detalii imprumut:
- Obiect: {device_name}
- Cod inventar: {device_code}
- ID imprumut: {loan_id}

Te rugam sa pastrezi acest mesaj pentru evidenta.

Acest email a fost trimis automat de aplicatia de inventariere.
"""
    )

    message.add_alternative(
        f"""\
<!doctype html>
<html lang="ro">
  <body style="font-family: Arial, sans-serif; color: #222;">
    <h2>Confirmare imprumut</h2>
    <p>Buna, <strong>{escape(person_name)}</strong>!</p>
    <p>A fost inregistrat un imprumut pe numele tau.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
      <tr>
        <td><strong>Obiect</strong></td>
        <td>{escape(device_name)}</td>
      </tr>
      <tr>
        <td><strong>Cod inventar</strong></td>
        <td>{escape(device_code)}</td>
      </tr>
      <tr>
        <td><strong>ID imprumut</strong></td>
        <td>{loan_id}</td>
      </tr>
    </table>
    <p>Te rugam sa pastrezi acest mesaj pentru evidenta.</p>
    <p style="color: #666; font-size: 12px;">
      Acest email a fost trimis automat de aplicatia de inventariere.
    </p>
  </body>
</html>
""",
        subtype="html",
    )

    context = ssl.create_default_context()

    if smtp_use_ssl:
        with smtplib.SMTP_SSL(
            smtp_host,
            smtp_port,
            context=context,
            timeout=15,
        ) as server:
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(message)
        return

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        server.ehlo()
        if smtp_use_tls:
            server.starttls(context=context)
            server.ehlo()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.send_message(message)
