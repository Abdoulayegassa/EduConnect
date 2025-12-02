// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const DayEnum = z.enum(['mon','tue','wed','thu','fri','sat','sun']);
const PodEnum = z.enum(['morning','afternoon','evening']);

const BodySchema = z.object({
  subject: z.string().min(2),
  // Produit visio-only
  mode: z.enum(['visio']).optional(),
  // Format recommandé
  slots: z.array(z.object({ day: DayEnum, pod: PodEnum })).optional(),
  // Legacy compat (à supprimer plus tard)
  timeSlots: z.array(z.string()).optional(),
  request_meta: z.any().optional(),
}).refine(
  (b) => (b.slots && b.slots.length > 0) || (b.timeSlots && b.timeSlots.length > 0),
  { message: 'Provide either slots or timeSlots with at least one entry' }
);

// --- utils ---
function simpleSlug(fr: string): string {
  return fr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeTimeSlotCode(s: string): { day?: string; pod?: string } {
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
  return Array.from(set).map((k) => {
    const [day, pod] = k.split(':');
    return { day, pod };
  });
}

function normalizeSlots(
  slots?: Array<{day:string;pod:string}>,
  timeSlots?: string[]
) {
  if (slots && slots.length) {
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
  return fromLegacyToSlots(timeSlots || []);
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const body = BodySchema.parse(payload);

    const supa = supabaseServer();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    const subject = body.subject.trim();
    const subject_slug = simpleSlug(subject);
    const slots = normalizeSlots(body.slots, body.timeSlots);

    // Produit visio-only
    const mode: 'visio' = 'visio';

    // 1) Création de la request
    const { data: reqRow, error: eInsert } = await supa
      .from('requests')
      .insert({
        student_id: user.id,
        subject,
        subject_slug,
        mode,           // visio-only
        status: 'open',
        slots,          // JSONB [{day,pod}]
        request_meta: body.request_meta ?? null,
      })
      .select('id, student_id, subject, subject_slug, mode, slots, status, created_at')
      .single();

    if (eInsert || !reqRow) {
      return NextResponse.json(
        { error: eInsert?.message ?? 'REQUEST_INSERT_ERROR' },
        { status: 400 }
      );
    }

    // 2) Matching instantané : crée des matches "proposed" et renvoie des tuteurs
    const { data: rawTutors, error: eRpc } = await supa.rpc(
      'match_tutors_for_request',
      { p_request_id: reqRow.id }
    );

    if (eRpc) {
      // On renvoie quand même la request, avec un warn
      return NextResponse.json(
        {
          request: reqRow,
          tutors: [],
          warn: eRpc.message,
        },
        { status: 201 }
      );
    }

    // Normalisation (type InstantTutor)
    const tutors = Array.isArray(rawTutors)
      ? rawTutors.map((t: any) => ({
          id: t.tutor_id ?? t.id,
          tutor_id: t.tutor_id ?? t.id,
          full_name: t.full_name ?? t.fullName ?? null,
          subjects: Array.isArray(t.subjects) ? t.subjects : [],
          levels: Array.isArray(t.levels) ? t.levels : [],
          rating: t.rating != null ? Number(t.rating) : null,
          reviews_count: t.reviews_count != null ? Number(t.reviews_count) : null,
          avatar_url: t.avatar_url ?? null,
          hourly_rate: t.hourly_rate ?? null,
          next_availabilities: Array.isArray(t.next_availabilities)
            ? t.next_availabilities
            : null,
        }))
      : [];

    return NextResponse.json(
      { request: reqRow, tutors },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'INVALID_BODY' },
      { status: 400 }
    );
  }
}
