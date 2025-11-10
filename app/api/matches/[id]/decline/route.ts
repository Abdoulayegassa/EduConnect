// app/api/matches/[id]/decline/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;

    // UUID v4 simple check
    if (!matchId || !/^[0-9a-f-]{36}$/i.test(matchId)) {
      return NextResponse.json({ error: 'match_id invalide' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Option A (recommandé) : RPC SQL (si créée)
    // const { error } = await supabase.rpc('decline_match', { p_match_id: matchId });

    // Option B : UPDATE direct (RLS fera le contrôle tuteur/étudiant)
    const { error } = await supabase
      .from('matches')
      .update({ status: 'declined' })
      .eq('id', matchId)
      .eq('status', 'proposed'); // évite de "décliner" un accepted

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
