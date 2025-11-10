// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const DayEnum = z.enum(['mon','tue','wed','thu','fri','sat','sun']);
const PodEnum = z.enum(['morning','afternoon','evening']);

const BodySchema = z.object({
  subject: z.string().min(2),
  mode: z.enum(['visio','presentiel']),
  // Nouveau format recommandé
  slots: z.array(z.object({ day: DayEnum, pod: PodEnum })).optional(),
  // Legacy: accepté pour compat
  timeSlots: z.array(z.string()).optional(),
  request_meta: z.any().optional(),
}).refine(
  (b) => (b.slots && b.slots.length > 0) || (b.timeSlots && b.timeSlots.length > 0),
  { message: 'Provide either slots or timeSlots with at least one entry' }
);

// --- utils ---
function simpleSlug(fr: string): string {
  return fr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function normalizeTimeSlotCode(s: string): { day?: string; pod?: string } {
  // accepte déjà "mon:evening" ou texte avec () → on enlève le suffixe parenthèse si présent
  const raw = s.replace(/\s*\([^)]*\)\s*$/g, '').trim().toLowerCase();
  const parts = raw.split(':').map((x) => x.trim());
  if (parts.length === 2) {
    const [day, pod] = parts;
    return { day, pod };
  }
  return {};
}

function fromLegacyToSlots(timeSlots: string[]) {
  const set = new Set<string>();
  for (const ts of timeSlots || []) {
    const { day, pod } = normalizeTimeSlotCode(ts);
    if (
      day && pod &&
      ['mon','tue','wed','thu','fri','sat','sun'].includes(day) &&
      ['morning','afternoon','evening'].includes(pod)
    ) {
      set.add(`${day}:${pod}`);
    }
  }
  // convert to [{day,pod}] unique
  return Array.from(set).map((k) => {
    const [day, pod] = k.split(':');
    return { day, pod };
  });
}

function normalizeSlots(slots?: Array<{day:string;pod:string}>, timeSlots?: string[]) {
  if (slots && slots.length) {
    // lower-case + filtre valeurs invalides + dédup
    const set = new Set<string>();
    for (const s of slots) {
      const day = String(s.day).toLowerCase();
      const pod = String(s.pod).toLowerCase();
      if (
        ['mon','tue','wed','thu','fri','sat','sun'].includes(day) &&
        ['morning','afternoon','evening'].includes(pod)
      ) {
        set.add(`${day}:${pod}`);
      }
    }
    return Array.from(set).map((k) => {
      const [day, pod] = k.split(':');
      return { day, pod };
    });
  }
  // fallback legacy
  return fromLegacyToSlots(timeSlots || []);
}

// --- handler ---
export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const supa = supabaseServer();

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

    const subject = body.subject.trim();
    const subject_slug = simpleSlug(subject);
    const slots = normalizeSlots(body.slots, body.timeSlots); // => [{day,pod}] minuscule & unique

    // Insertion (RLS: set_request_owner peut aussi remplir student_id, ici on le met explicitement)
    const { data: reqRow, error: eInsert } = await supa
      .from('requests')
      .insert({
        student_id: user.id,
        subject,
        subject_slug,
        mode: body.mode,
        status: 'open',
        slots,                  // ← JSONB propre (le trigger normalize_request_slots assurera aussi une dernière passe)
        request_meta: body.request_meta ?? null,
      })
      .select('id, subject, mode, slots, status, created_at, subject_slug')
      .single();

    if (eInsert) {
      return NextResponse.json({ error: eInsert.message }, { status: 400 });
    }

    // Matching instantané (la RPC peut créer des matches 'proposed')
    const { data: tutors, error: eRpc } = await supa.rpc('match_tutors_for_request', {
      p_request_id: reqRow.id,
    });

    if (eRpc) {
      return NextResponse.json({ request: reqRow, tutors: [], warn: eRpc.message }, { status: 201 });
    }

    return NextResponse.json({ request: reqRow, tutors: tutors ?? [] }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'INVALID_BODY' }, { status: 400 });
  }
}
