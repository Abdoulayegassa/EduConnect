import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import sendWhatsApp from '@/lib/notify/whatsapp';

export const dynamic = 'force-dynamic'; // pour cron

// --- Types utiles ---
type OutboxEvent = {
  id: number;
  topic: 'match.proposed' | 'session.created' | string;
  payload: any;
  attempts: number;
  status?: 'pending' | 'sent' | 'failed';
};

type ReqInfo = {
  subject?: string | null;
  level?: string | null;
  time_slots?: string[] | null;
};

type MatchRow = {
  id: number;
  request_id: number;
  tutor_id: string;
  // NOTE: en fonction du mapping supabase, "requests" peut être un objet ou un tableau
  requests?: ReqInfo | ReqInfo[];
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  profile_meta?: Record<string, any> | null;
};

type SessionRow = {
  id: number;
  starts_at: string | null;
  jitsi_link: string | null;
  tutor_id: string | null;
  student_id: string | null;
  request_id: number | null;
};

export async function GET() {
  const supa = supabaseServer();

  // 1) Batch d'événements "pending"
  const { data: events, error } = await supa
    .from('outbox_events')
    .select('id, topic, payload, attempts')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('id', { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events?.length) return NextResponse.json({ ok: true, processed: 0 });

  let processed = 0;

  for (const ev of events as OutboxEvent[]) {
    try {
      // 2) Router selon topic
      if (ev.topic === 'match.proposed') {
        await handleMatchProposed(ev.payload);
      } else if (ev.topic === 'session.created') {
        await handleSessionCreated(ev.payload);
      } else {
        // Topics non gérés → on considère "sent" pour ne pas bloquer la file
      }

      // 3) Mark sent
      await supa
        .from('outbox_events')
        .update({ status: 'sent', processed_at: new Date().toISOString() })
        .eq('id', ev.id);
      processed++;
    } catch {
      // 4) Backoff simple
      await supa
        .from('outbox_events')
        .update({ status: 'pending', attempts: ev.attempts + 1 })
        .eq('id', ev.id);
    }
  }

  return NextResponse.json({ ok: true, processed });
}

function normalizeOneReq(reqs?: ReqInfo | ReqInfo[] | null): ReqInfo | undefined {
  if (!reqs) return undefined;
  return Array.isArray(reqs) ? reqs[0] : reqs;
}

function getWhatsAppTo(profile?: ProfileRow | null): string | undefined {
  return ((profile?.profile_meta as any)?.whatsapp_to as string | undefined) || process.env.WHATSAPP_TEST_TO;
}

async function handleMatchProposed(payload: any) {
  const supa = supabaseServer();

  // Charger le match + la request liée
  const { data: match } = await supa
    .from('matches')
    .select('id, request_id, tutor_id, requests:request_id(subject, level, time_slots)')
    .eq('id', payload?.match_id)
    .single<MatchRow>();

  if (!match) return;

  // Normaliser la relation (objet garanti)
  const req = normalizeOneReq(match.requests);
  const subject = req?.subject ?? '—';
  const slotsList = Array.isArray(req?.time_slots) ? req!.time_slots! : [];
  const slots = slotsList.join(', ');

  // Infos tuteur (numéro/WhatsApp)
  const { data: tutor } = await supa
    .from('profiles')
    .select('id, full_name, profile_meta')
    .eq('id', match.tutor_id)
    .single<ProfileRow>();

  const to = getWhatsAppTo(tutor);
  if (!to) return;

  await sendWhatsApp({
    to,
    body: `Nouvelle demande: ${subject}. Créneaux: ${slots}.\nAcceptez depuis votre tableau de bord.`
  });
}

async function handleSessionCreated(payload: any) {
  const supa = supabaseServer();

  const { data: session } = await supa
    .from('sessions')
    .select('id, starts_at, jitsi_link, tutor_id, student_id, request_id')
    .eq('id', payload?.session_id)
    .single<SessionRow>();

  if (!session) return;

  // Charger tuteur & étudiant
  const [{ data: tutor }, { data: student }] = await Promise.all([
    supa.from('profiles').select('id, full_name, profile_meta').eq('id', session.tutor_id).maybeSingle<ProfileRow>(),
    supa.from('profiles').select('id, full_name, profile_meta').eq('id', session.student_id).maybeSingle<ProfileRow>()
  ]);

  const toTutor = getWhatsAppTo(tutor);
  const toStudent = getWhatsAppTo(student);
  const when = session.starts_at ? new Date(session.starts_at).toLocaleString() : 'À planifier';
  const link = session.jitsi_link ? `\nLien: ${session.jitsi_link}` : '';

  // Étudiant
  if (toStudent) {
    await sendWhatsApp({
      to: toStudent,
      body: `Ton tuteur est trouvé ✅\nSéance: ${when}${link}`
    });
  }

  // Tuteur
  if (toTutor) {
    await sendWhatsApp({
      to: toTutor,
      body: `Nouvelle séance planifiée.\nHeure: ${when}${link}`
    });
  }
}
