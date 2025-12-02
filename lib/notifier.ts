// lib/notifier.ts
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

let client: Resend | null = null;

function getClient() {
  if (!client) {
    if (!RESEND_API_KEY) {
      console.warn('[notifier] RESEND_API_KEY manquant, les emails ne seront pas envoyés.');
      return null;
    }
    client = new Resend(RESEND_API_KEY);
  }
  return client;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const resend = getClient();

  // En local sans clé → on log seulement
  if (!resend) {
    console.log('[MOCK EMAIL]', { to, subject /*, html*/ });
    return { ok: false, mocked: true };
  }

  await resend.emails.send({
    from: 'EduConnect <no-reply@ton-domaine.com>',
    to,
    subject,
    html,
  });

  return { ok: true };
}
