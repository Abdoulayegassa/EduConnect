// app/api/notifications/seen/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1)
});

export async function POST(req: Request) {
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const body = BodySchema.parse(json);

  const { error } = await supa
    .from('notifications')
    .update({ seen_at: new Date().toISOString() })
    .in('id', body.ids)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
