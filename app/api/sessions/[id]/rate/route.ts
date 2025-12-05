// app/api/sessions/[id]/rate/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const BodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'SESSION_ID_MISSING' },
        { status: 400 }
      );
    }

    const supa = supabaseServer();

    // 1) Auth
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();

    if (authErr) {
      console.error('[rate] auth error', authErr);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }

    // 2) Body
    const json = await req.json().catch(() => ({}));
    const body = BodySchema.parse(json);

    // 3) Vérifier que la session existe et appartient à l’étudiant
    const { data: sessionRow, error: sErr } = await supa
      .from('sessions')
      .select('id, student_id, tutor_id, starts_at, ends_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (sErr) {
      return NextResponse.json(
        { ok: false, error: sErr.message },
        { status: 400 }
      );
    }

    if (!sessionRow) {
      return NextResponse.json(
        { ok: false, error: 'SESSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (sessionRow.student_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 4) Option : ne noter que les sessions terminées
    if (sessionRow.ends_at) {
      const end = new Date(sessionRow.ends_at).getTime();
      const now = Date.now();
      if (end > now) {
        return NextResponse.json(
          { ok: false, error: 'SESSION_NOT_FINISHED_YET' },
          { status: 400 }
        );
      }
    }

    // 5) Enregistrer la note dans une table dédiée
    const { error: rErr } = await supa
      .from('session_ratings')
      .upsert(
        {
          session_id: sessionRow.id,
          tutor_id: sessionRow.tutor_id,
          student_id: sessionRow.student_id,
          rating: body.rating,
          comment: body.comment ?? null,
        },
        {
          onConflict: 'session_id', // nécessite un index unique sur session_id
        }
      );

    if (rErr) {
      console.error('[rate] upsert error', rErr);
      return NextResponse.json(
        { ok: false, error: rErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('/api/sessions/[id]/rate error', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
