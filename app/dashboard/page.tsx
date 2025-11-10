import { redirect } from 'next/navigation';
import { supabaseServerWithAuth } from '@/lib/supabase/server-auth';

export default async function DashboardPivot() {
  const supa = supabaseServerWithAuth();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supa
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.role) {
    const roleHint = (user.user_metadata as any)?.role;
    const qs = roleHint ? `?complete=1&role=${encodeURIComponent(roleHint)}` : '?complete=1';
    redirect(`/auth/register${qs}`);
  }

  if (profile.role === 'student') redirect('/dashboard/student');
  if (profile.role === 'tutor')   redirect('/dashboard/tutor');

  redirect('/auth/login');
}
