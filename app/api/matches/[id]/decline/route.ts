// app/api/matches/[id]/decline/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

type RouteParams = {
  params: {
    id: string; // vient de [id] dans le dossier
  };
};

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const matchId = params.id;

    if (!matchId || !/^[0-9a-f-]{36}$/i.test(matchId)) {
      return NextResponse.json(
        { error: 'match_id invalide' },
        { status: 400 },
      );
    }

    const supa = supabaseServer();

    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();

    if (authErr) {
      console.error('auth.getUser error', authErr);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 },
      );
    }

    // On ne décline que si :
    // - le match est encore 'proposed'
    // - et appartient bien au tuteur connecté
    const { data, error } = await supa
      .from('matches')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('tutor_id', user.id)
      .eq('status', 'proposed')
      .select('id, status, request_id, tutor_id')
      .maybeSingle();

    if (error) {
      console.error('matches UPDATE decline error', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Match introuvable ou déjà traité' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, match: data },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('decline match exception', e);
    return NextResponse.json(
      { error: e?.message ?? 'Erreur serveur' },
      { status: 500 },
    );
  }
}
