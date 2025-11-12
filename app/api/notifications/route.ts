// app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTH' }, { status: 401 });

  const { data, error } = await supa
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
    .order('seen_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notifications: data ?? [] });
}
