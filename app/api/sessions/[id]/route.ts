// app/api/sessions/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const PatchSchema = z.object({
  startsAt: z.string().datetime().optional(),
  jitsiLink: z.string().url().optional(),
  mode: z.enum(['visio']).optional()
}).refine(obj => Object.keys(obj).length > 0, { message: 'No fields' });

function isUUID(s?: string) { return !!s && /^[0-9a-f-]{36}$/i.test(s); }

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isUUID(params.id)) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });

  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const json = await (async () => { try { return await req.json(); } catch { return {}; } })();
  const body = PatchSchema.parse(json);

  // lire session + contrôles d’accès (proprio étudiant ou tuteur)
  const { data: sess, error: e1 } = await supa
    .from('sessions')
    .select(`
      id, match_id, request_id, starts_at, mode, jitsi_link,
      match:matches!inner ( id, tutor_id, request_id,
        request:requests!inner ( id, student_id )
      )
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
  if (!sess) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const reqRow = Array.isArray(sess.match?.request) ? sess.match.request[0] : sess.match?.request;
  const isOwner = reqRow?.student_id === user.id || sess.match?.tutor_id === user.id;
  if (!isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const upd: any = {};
  if (body.startsAt) upd.starts_at = new Date(body.startsAt).toISOString();
  if (body.jitsiLink) upd.jitsi_link = body.jitsiLink;
  if (body.mode) upd.mode = body.mode;

  const { data, error } = await supa
    .from('sessions')
    .update(upd)
    .eq('id', params.id)
    .select('id, starts_at, jitsi_link, mode')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // Le trigger “updated” enverra les notifications.
  return NextResponse.json({ ok: true, session: data });
}
