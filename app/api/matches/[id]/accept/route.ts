// app/api/matches/[id]/accept/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const BodySchema = z.object({
  startsAt: z.string().datetime().optional(),       // ISO8601
  durationMin: z.number().int().positive().max(480).optional(),
});

function isUUID(s?: string) {
  return !!s && /^[0-9a-f-]{36}$/i.test(s);
}

// === helpers (day/pod/slot_code) ===
const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayCode = typeof DAY_CODES[number];
type Pod = 'morning' | 'afternoon' | 'evening';

function toDayCode(d: Date): DayCode {
  return DAY_CODES[d.getDay()]; // JS: 0=Sunday..6=Saturday
}
function toPod(d: Date): Pod {
  const h = d.getHours();
  // même logique UI : matin (8–12), aprem (12–18), soir (18–22)
  if (h >= 18) return 'evening';
  if (h >= 12) return 'afternoon';
  return 'morning';
}
function toSlotCode(d: Date) {
  const day = toDayCode(d);
  const pod = toPod(d);
  return { day, pod, slot_code: `${day}:${pod}` };
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params?.id;
    if (!isUUID(matchId)) {
      return NextResponse.json({ success: false, error: 'match_id invalide' }, { status: 400 });
    }

    const supa = supabaseServer();

    // Auth
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const json = await (async () => { try { return await req.json(); } catch { return {}; } })();
    const body = BodySchema.parse(json || {});

    // 1) Charger le match + vérifier l’auteur (élève)
    const { data: m, error: eMatch } = await supa
      .from('matches')
      .select(`
        id, status, tutor_id, request_id,
        request:requests!inner ( id, student_id, mode )
      `)
      .eq('id', matchId)
      .maybeSingle();

    if (eMatch) return NextResponse.json({ success: false, error: eMatch.message }, { status: 400 });
    if (!m) return NextResponse.json({ success: false, error: 'MATCH_NOT_FOUND' }, { status: 404 });

    const reqRow: any = Array.isArray((m as any).request) ? (m as any).request[0] : (m as any).request;
    if (reqRow?.student_id !== user.id) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    }
    if (m.status === 'accepted') {
      return NextResponse.json({ success: true, warning: 'ALREADY_ACCEPTED' }, { status: 200 });
    }
    if (m.status !== 'proposed') {
      return NextResponse.json({ success: false, error: 'INVALID_STATE' }, { status: 409 });
    }

    // 2) Acceptation atomique
    const { data: upd, error: eUpd } = await supa
      .from('matches')
      .update({ status: 'accepted' })
      .eq('id', matchId)
      .eq('status', 'proposed')
      .select('id, request_id, tutor_id')
      .maybeSingle();

    if (eUpd) return NextResponse.json({ success: false, error: eUpd.message }, { status: 400 });
    if (!upd) return NextResponse.json({ success: false, error: 'CONFLICT_ALREADY_ACCEPTED' }, { status: 409 });

    // 3) Créer la session (par défaut: +1h)
    const startsAt = body.startsAt
      ? new Date(body.startsAt)
      : new Date(Date.now() + 60 * 60 * 1000);
    const durationMin = body.durationMin ?? 60;

    const jitsi_link = `https://meet.jit.si/edu-${upd.id.slice(0, 8)}-${Date.now().toString(36)}`;

    const { data: sess, error: eSess } = await supa
      .from('sessions')
      .insert({
        request_id: upd.request_id,
        match_id: upd.id,
        starts_at: startsAt.toISOString(),
        mode: reqRow?.mode ?? 'visio',
        jitsi_link,
        // ⚠️ décommente seulement si ta colonne existe :
        // duration_min: durationMin as any,
      } as any)
      .select('id, starts_at, jitsi_link')
      .single();

    const sessionRow =
      sess ??
      (await (async () => {
        if (!eSess) return null;
        const { data: existing } = await supa
          .from('sessions')
          .select('id, starts_at, jitsi_link')
          .eq('match_id', upd.id)
          .maybeSingle();
        return existing ?? null;
      })());

    if (!sessionRow && eSess) {
      return NextResponse.json({ success: false, error: eSess.message }, { status: 400 });
    }

    // 4) Consommer la disponibilité du tuteur (SUPPRESSION dans tutor_availabilities)
    try {
      const { day, pod, slot_code } = toSlotCode(startsAt);

      // 4a. via slot_code
      const del1 = await supa
        .from('tutor_availabilities')
        .delete()
        .match({ tutor_id: upd.tutor_id, slot_code })
        .select('tutor_id'); // pour pouvoir compter

      const deleted1 = Array.isArray(del1.data) ? del1.data.length : 0;

      // 4b. fallback via (day, pod) si rien supprimé
      if (deleted1 === 0) {
        await supa
          .from('tutor_availabilities')
          .delete()
          .match({ tutor_id: upd.tutor_id, day, pod })
          .select('tutor_id');
      }
    } catch (e) {
      // non bloquant
      console.warn('consume tutor availability warning:', e);
    }

    return NextResponse.json({ success: true, session: sessionRow }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'SERVER_ERROR' }, { status: 500 });
  }
}
