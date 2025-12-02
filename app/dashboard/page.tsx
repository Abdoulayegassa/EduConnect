import { redirect } from 'next/navigation';
import { supabaseServerWithAuth } from '@/lib/supabase/server-auth';

export default async function DashboardPivot() {
  const supa = supabaseServerWithAuth();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile, error } = await supa
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Si erreur DB → on renvoie vers login par sécurité
  if (error) redirect('/auth/login');

  if (!profile?.role) {
    const roleHint = (user.user_metadata as any)?.role;
    const qs = roleHint ? `?complete=1&role=${encodeURIComponent(roleHint)}` : '?complete=1';
    redirect(`/auth/register${qs}`);
  }

  if (profile.role === 'student') redirect('/dashboard/student');
  if (profile.role === 'tutor')   redirect('/dashboard/tutor');

  // Fallback (si un jour tu as 'admin' par exemple)
  redirect('/auth/login');
}
