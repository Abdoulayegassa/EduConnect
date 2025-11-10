import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import sendWhatsApp from '@/lib/notify/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supa = supabaseServer();

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const { data: sessions, error } = await supa
    .from('sessions')
    .select('id, starts_at, jitsi_link, tutor_id, student_id, reminder_status')
    .gte('starts_at', start.toISOString())
    .lte('starts_at', end.toISOString())
    .eq('reminder_status', 'pending')
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sessions?.length) return NextResponse.json({ ok: true, reminders: 0 });

  let sent = 0;

  for (const s of sessions) {
    // charger numéros
    const { data: tutor } = await supa.from('profiles').select('id, full_name, profile_meta').eq('id', s.tutor_id).single();
    const { data: student } = await supa.from('profiles').select('id, full_name, profile_meta').eq('id', s.student_id).single();

    const toTutor = (tutor?.profile_meta as any)?.whatsapp_to ?? process.env.WHATSAPP_TEST_TO;
    const toStudent = (student?.profile_meta as any)?.whatsapp_to ?? process.env.WHATSAPP_TEST_TO;

    const when = s.starts_at ? new Date(s.starts_at).toLocaleString() : '—';
    const link = s.jitsi_link ? `\nLien: ${s.jitsi_link}` : '';

    await Promise.all([
      sendWhatsApp({ to: toTutor, body: `Rappel 🔔\nSéance demain à ${when}.${link}` }),
      sendWhatsApp({ to: toStudent, body: `Rappel 🔔\nSéance demain à ${when}.${link}` }),
    ]);

    await supa.from('sessions').update({ reminder_status: 'sent' }).eq('id', s.id);
    sent++;
  }

  return NextResponse.json({ ok: true, reminders: sent });
}