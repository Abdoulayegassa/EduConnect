// app/api/profile/route.ts  ✅ (version à garder si tu n’en as qu’une)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const UpSchema = z.object({
  full_name: z.string().min(2),
  bio: z.string().max(2000).optional(),
  subjects: z.array(z.string()).min(1),
  modes: z.array(z.enum(['visio', 'presentiel'])).min(1),
  city: z.string().optional().nullable(),
  price_cents: z.number().int().min(0).optional().nullable(),
});

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export async function GET() {
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { data, error } = await supa
    .from('profiles')
    .select('id, role, full_name, bio, subjects, subject_slugs, modes, city, city_norm, price_cents')
    .eq('id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ profile: data });
}

export async function PUT(req: Request) {
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json();
  const p = UpSchema.parse(body);

  const subject_slugs = p.subjects.map(norm);
  const city_norm = p.city ? norm(p.city) : null;

  const { error } = await supa
    .from('profiles')
    .update({
      role: 'tutor', // s’assure que le profil est bien tuteur
      full_name: p.full_name,
      bio: p.bio ?? null,
      subjects: p.subjects,
      subject_slugs,
      modes: p.modes,
      city: p.city ?? null,
      city_norm,
      price_cents: p.price_cents ?? null,
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
