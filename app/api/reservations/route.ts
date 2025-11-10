// app/api/reservations/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const BodySchema = z.object({
  requestId: z.string().uuid(),
  tutorId: z.string().uuid(),
  startsAt: z.string().datetime().optional(),     // ISO string
  durationMin: z.number().int().positive().max(480).optional(),
});

// Helpers pour day/pod/slot_code (mêmes tranches que l’UI)
const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayCode = typeof DAY_CODES[number];
type Pod = 'morning' | 'afternoon' | 'evening';

function toDayCode(d: Date): DayCode {
  return DAY_CODES[d.getDay()]; // JS: 0=Sunday..6=Saturday
}
function toPod(d: Date): Pod {
  const h = d.getHours();
  if (h >= 18) return 'evening';
  if (h >= 12) return 'afternoon';
  return 'morning';
}
function toSlotParts(d: Date) {
  const day = toDayCode(d);
  const pod = toPod(d);
  return { day, pod, slot_code: `${day}:${pod}` };
}

export async function POST(req: Request) {
  try {
    const supa = supabaseServer();

    // Auth
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });

    // Payload
    const raw = await (async () => { try { return await req.json(); } catch { return {}; } })();
    const body = BodySchema.parse(raw || {});
    const { requestId, tutorId } = body;

    // Defaults (si non fournis)
    const starts_at = body.startsAt ? new Date(body.startsAt) : new Date(Date.now() + 60 * 60 * 1000); // +1h
    const duration_min = typeof body.durationMin === 'number' ? body.durationMin : 60;

    // 1) RPC atomique (match + accept + session)
    const { data, error } = await supa.rpc('match_and_accept_tutor', {
      p_request_id: requestId,
      p_tutor_id: tutorId,
      p_starts_at: starts_at.toISOString(),
      p_duration_min: duration_min,
    });

    if (error) {
      const msg = String(error.message || '');
      const mapStatus = (m: string) => {
        if (m.includes('REQUEST_NOT_FOUND')) return 404;
        if (m.includes('FORBIDDEN')) return 403;
        if (m.includes('INVALID_REQUEST_STATUS')) return 409;
        if (m.includes('TUTOR_NOT_FOUND')) return 404;
        if (m.includes('REQUEST_ALREADY_HAS_ACCEPTED_MATCH')) return 409;
        return 400;
      };
      return NextResponse.json({ success: false, error: msg }, { status: mapStatus(msg) });
    }

    // Normalise le retour RPC (record/table)
    const row = Array.isArray(data) ? data[0] : data;
    const sessionId: string | null = row?.v_session_id ?? row?.session_id ?? null;
    const matchId: string | null   = row?.v_match_id   ?? row?.match_id   ?? null;

    // 2) Relire la session (source de vérité)
    let sessionRow: { id: string; starts_at: string | null; jitsi_link: string | null; mode?: 'visio'|'presentiel'|null } | null = null;

    if (sessionId) {
      const { data: s } = await supa
        .from('sessions')
        .select('id, starts_at, jitsi_link, mode')
        .eq('id', sessionId)
        .maybeSingle();
      sessionRow = s ?? null;
    } else if (matchId) {
      const { data: s } = await supa
        .from('sessions')
        .select('id, starts_at, jitsi_link, mode')
        .eq('match_id', matchId)
        .maybeSingle();
      sessionRow = s ?? null;
    }

    // 3) Consommer la dispo du tuteur selon l’horaire réel de la session
    if (sessionRow?.starts_at) {
      try {
        const start = new Date(sessionRow.starts_at);
        const { day, pod, slot_code } = toSlotParts(start);

        // (a) suppression via slot_code (index + unique)
        const del1 = await supa
          .from('tutor_availabilities')
          .delete()
          .match({ tutor_id: tutorId, slot_code })
          .select('tutor_id'); // pour compter
        const deleted1 = Array.isArray(del1.data) ? del1.data.length : 0;

        // (b) fallback (day, pod) si slot_code absent
        if (deleted1 === 0) {
          await supa
            .from('tutor_availabilities')
            .delete()
            .match({ tutor_id: tutorId, day, pod })
            .select('tutor_id');
        }
      } catch (e) {
        // non bloquant
        console.warn('consume tutor availability warning:', e);
      }
    }

    // 4) Réponse normalisée
    return NextResponse.json({
      success: true,
      session: sessionRow
        ? { id: sessionRow.id, startsAt: sessionRow.starts_at, jitsiLink: sessionRow.jitsi_link, mode: sessionRow.mode ?? null }
        : { id: sessionId, startsAt: starts_at.toISOString(), jitsiLink: null, mode: null },
      match: { id: matchId, tutorId },
    }, { status: 200 });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
