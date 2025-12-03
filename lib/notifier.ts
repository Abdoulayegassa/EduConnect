// lib/notifier.ts
import { Resend } from 'resend';

const resendKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.RESEND_FROM_EMAIL ?? 'EduConnect <onboarding@resend.dev>';

if (!resendKey) {
  console.warn('[notifier] RESEND_API_KEY not set, emails disabled');
} else {
  console.log('[notifier] RESEND_API_KEY loaded');
}

const resend = resendKey ? new Resend(resendKey) : null;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn('[sendEmail] SKIP (no RESEND_API_KEY)', { to, subject });
    return;
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });

    console.log('[sendEmail] sent', {
      to,
      subject,
      id: result.data?.id,
    });

    return result;
  } catch (err) {
    console.error('[sendEmail] ERROR', err);
    // On ne throw pas pour ne pas casser /api/reservations
  }
}
