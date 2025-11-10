// app/api/match/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Query params acceptés :
 * - subject: string (obligatoire pour déclencher la recherche)
 * - mode: 'visio' | 'presentiel' (optionnel)
 * - slots: "mon:evening,tue:morning" (optionnel, on prend le 1er pour le preview)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subject = (searchParams.get('subject') || '').trim();
    const mode = (searchParams.get('mode') || '').trim();
    const slotsCsv = (searchParams.get('slots') || '').trim();

    if (!subject) {
      // Toujours renvoyer un objet normalisé
      return NextResponse.json({ tutors: [] }, { status: 200 });
    }

    // On prend le 1er slot pour un match "preview"
    let slot: string | null = null;
    if (slotsCsv) {
      const first = slotsCsv.split(',').map(s => s.trim()).filter(Boolean)[0];
      if (first) slot = first;
    }

    const supa = supabaseServer();
    const { data, error } = await supa.rpc('match_tutors_preview', {
      p_subject: subject,
      p_slot: slot, // peut être null côté RPC
      p_mode: mode || null, // si tu as ajouté ce param en SQL, sinon laisse-le ignoré côté SQL
    } as any);

    if (error) {
      console.error('match_tutors_preview error', error);
      return NextResponse.json({ tutors: [], warn: error.message }, { status: 200 });
    }

    // Normalisation stricte
    const tutors = (data ?? []).map((t: any) => ({
      id: t.tutor_id ?? t.id,
      tutor_id: t.tutor_id ?? t.id,
      full_name: t.full_name ?? t.fullName ?? null,
      subjects: Array.isArray(t.subjects) ? t.subjects : [],
      levels: Array.isArray(t.levels) ? t.levels : [],
      rating: Number(t.rating ?? 0),
      reviews_count: Number(t.reviews_count ?? 0),
      avatar_url: t.avatar_url ?? null,
      hourly_rate: t.hourly_rate ?? null,
      next_availabilities: Array.isArray(t.next_availabilities) ? t.next_availabilities : null,
    }));

    return NextResponse.json({ tutors }, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ tutors: [], error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
