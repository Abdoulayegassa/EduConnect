// app/api/matches/[id]/accept/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const BodySchema = z.object({
  // Optionnels : l’élève peut préciser la date/heure exacte et la durée
  startsAt: z.string().datetime().optional(),       // ISO8601
  durationMin: z.number().int().positive().max(480).optional(),
});

function isUUID(s?: string) {
  return !!s && /^[0-9a-f-]{36}$/i.test(s);
}

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayCode = (typeof DAY_CODES)[number];
type Pod = 'morning' | 'afternoon' | 'evening';

function toDayCode(d: Date): DayCode {
  return DAY_CODES[d.getDay()];
}
function toPod(d: Date): Pod {
  const h = d.getHours();
  if (h >= 18) return 'evening';
  if (h >= 12) return 'afternoon';
  return 'morning';
}
function toSlotCode(d: Date) {
  const day = toDayCode(d);
  const pod = toPod(d);
  return { day, pod, slot_code: `${day}:${pod}` };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const matchId = params?.id;
    if (!isUUID(matchId)) {
      return NextResponse.json(
        { success: false, error: 'MATCH_ID_INVALID' },
        { status: 400 },
      );
    }

    const supa = supabaseServer();

    // 0) Auth
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();

    if (authErr) {
      return NextResponse.json(
        { success: false, error: authErr.message },
        { status: 500 },
      );
    }
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    // 1) Body (facultatif)
    const json = await (async () => {
      try {
        return await req.json();
      } catch {
        return {};
      }
    })();
    const body = BodySchema.parse(json || {});

    // 2) Charger le match + la request (pour vérifier que c’est BIEN l’élève)
    const { data: m, error: eMatch } = await supa
      .from('matches')
      .select(
        `
        id, status, tutor_id, request_id,
        request:requests!inner ( id, student_id, mode )
      `,
      )
      .eq('id', matchId)
      .maybeSingle();

    if (eMatch) {
      return NextResponse.json(
        { success: false, error: eMatch.message },
        { status: 400 },
      );
    }
    if (!m) {
      return NextResponse.json(
        { success: false, error: 'MATCH_NOT_FOUND' },
        { status: 404 },
      );
    }

    const matchRow: any = m;
    const reqRow: any = Array.isArray(matchRow.request)
      ? matchRow.request[0]
      : matchRow.request;

    // ✅ Vérifier que c’est bien l’ÉLÈVE qui accepte
    if (!reqRow?.student_id || reqRow.student_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN_NOT_STUDENT' },
        { status: 403 },
      );
    }

    // ✅ États autorisés
    if (matchRow.status === 'accepted') {
      // Idempotent : déjà accepté → on renvoie OK
      return NextResponse.json(
        { success: true, warning: 'ALREADY_ACCEPTED' },
        { status: 200 },
      );
    }

    if (matchRow.status !== 'proposed') {
      return NextResponse.json(
        { success: false, error: 'INVALID_STATE' },
        { status: 409 },
      );
    }

    // 3) Accepter le match de façon atomique
    const { data: upd, error: eUpd } = await supa
      .from('matches')
      .update({ status: 'accepted' })
      .eq('id', matchId)
      .eq('status', 'proposed')
      .select('id, request_id, tutor_id')
      .maybeSingle();

    if (eUpd) {
      return NextResponse.json(
        { success: false, error: eUpd.message },
        { status: 400 },
      );
    }
    if (!upd) {
      // quelqu’un a déjà modifié le match
      return NextResponse.json(
        { success: false, error: 'CONFLICT_ALREADY_ACCEPTED_OR_CHANGED' },
        { status: 409 },
      );
    }

    // 4) Vérifier s’il existe déjà une session pour ce match
    const { data: existingSession, error: eExisting } = await supa
      .from('sessions')
      .select('id, starts_at, ends_at, jitsi_link')
      .eq('match_id', upd.id)
      .maybeSingle();

    if (eExisting) {
      // on logue mais on ne bloque pas forcément, sauf gros souci
      console.warn('Error checking existing session:', eExisting);
    }

    if (existingSession) {
      // Session déjà créée (par un autre flux) → on renvoie tel quel
      return NextResponse.json(
        { success: true, session: existingSession },
        { status: 200 },
      );
    }

    // 5) Créer la session maintenant (cas standard : aucune session encore)
    const startsAt = body.startsAt
      ? new Date(body.startsAt)
      : new Date(Date.now() + 60 * 60 * 1000); // par défaut +1h

    const durationMin = body.durationMin ?? 60;
    const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

    const jitsi_link = `https://meet.jit.si/edu-${upd.id.slice(
      0,
      8,
    )}-${Date.now().toString(36)}`;
    const { slot_code } = toSlotCode(startsAt);

    // mode de la demande (fallback visio par sécurité)
    const sessionMode =
      reqRow?.mode === 'visio' || reqRow?.mode === 'presentiel'
        ? reqRow.mode
        : 'visio';

    const { data: sess, error: eSess } = await supa
      .from('sessions')
      .insert({
        request_id: upd.request_id,
        match_id: upd.id,
        student_id: reqRow.student_id,
        tutor_id: upd.tutor_id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        mode: sessionMode,
        slot_code,
        jitsi_link,
      } as any)
      .select('id, starts_at, ends_at, jitsi_link')
      .maybeSingle();

    if (eSess) {
      return NextResponse.json(
        { success: false, error: eSess.message },
        { status: 400 },
      );
    }
    if (!sess) {
      return NextResponse.json(
        { success: false, error: 'SESSION_INSERT_FAILED' },
        { status: 500 },
      );
    }

    // NB : on NE gère PAS ici la suppression des disponibilités,
    // c’est le trigger fn_consume_avail_on_session() qui s’en charge
    // via trg_consume_avail_on_session AFTER INSERT ON sessions.

    return NextResponse.json(
      { success: true, session: sess },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('MATCH_ACCEPT_ERROR', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
