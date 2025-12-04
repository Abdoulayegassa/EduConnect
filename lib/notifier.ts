// lib/notifier.ts
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'EduConnect <onboarding@resend.dev>';

if (!RESEND_API_KEY) {
  console.warn('[notifier] RESEND_API_KEY is MISSING – emails will NOT be sent');
} else {
  console.log('[notifier] RESEND_API_KEY loaded');
  console.log('[notifier] EMAIL_FROM =', EMAIL_FROM);
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn('[sendEmail] called but resend client is NULL – check RESEND_API_KEY');
    return;
  }

  try {
    console.log('[sendEmail] sending...', { to, subject });

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[sendEmail] ERROR', error);
      throw error;
    }

    console.log('[sendEmail] sent', {
      to,
      subject,
      id: data?.id,
    });
  } catch (e) {
    console.error('[sendEmail] EXCEPTION', e);
    throw e;
  }
}
