// app/api/sessions/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const PatchSchema = z.object({
  startsAt: z.string().datetime().optional(),
  jitsiLink: z.string().url().optional(),
  mode: z.enum(['visio']).optional(), // produit simplifié: visio only
}).refine((o) => Object.keys(o).length > 0, { message: 'No fields' });

function isUUID(s?: string) {
  return !!s && /^[0-9a-f-]{36}$/i.test(s);
}

/** Types locaux correspondant EXACTEMENT au select ci-dessous */
type MatchRequestRow = { id: string; student_id: string };
type MatchRow = {
  id: string;
  tutor_id: string;
  request_id: string;
  request: MatchRequestRow; // objet, pas tableau
};
type SessionRow = {
  id: string;
  match_id: string | null;
  request_id: string | null;
  starts_at: string;
  mode: 'visio';
  jitsi_link: string | null;
  match: MatchRow;
};

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isUUID(params.id)) {
    return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });
  }

  const supa = supabaseServer();
  const { data: auth } = await supa.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const json = await (async () => { try { return await req.json(); } catch { return {}; } })();
  const body = PatchSchema.parse(json);

  // ⚠️ Select structuré pour obtenir des objets (et pas des tableaux) côté TS
  // - alias "match" => objet unique (thanks to .maybeSingle() + !inner)
  // - alias "request" => objet unique
  const { data: sess, error: e1 } = await supa
    .from('sessions')
    .select(`
      id, match_id, request_id, starts_at, mode, jitsi_link,
      match:matches!inner (
        id, tutor_id, request_id,
        request:requests!inner ( id, student_id )
      )
    `)
    .eq('id', params.id)
    .maybeSingle<SessionRow>(); // <-- typing explicite

  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
  if (!sess) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // Accès: propriétaire étudiant OU tuteur de la session
  const isOwner =
    sess.match.request.student_id === user.id ||
    sess.match.tutor_id === user.id;

  if (!isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const upd: Partial<Pick<SessionRow, 'starts_at' | 'jitsi_link' | 'mode'>> = {};
  if (body.startsAt) upd.starts_at = new Date(body.startsAt).toISOString();
  if (body.jitsiLink) upd.jitsi_link = body.jitsiLink;
  if (body.mode) upd.mode = body.mode;

  const { data, error } = await supa
    .from('sessions')
    .update(upd as any)
    .eq('id', params.id)
    .select('id, starts_at, jitsi_link, mode')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Les triggers notif/log prennent le relais
  return NextResponse.json({ ok: true, session: data }, { status: 200 });
}
