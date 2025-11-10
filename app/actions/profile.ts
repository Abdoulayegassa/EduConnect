'use server';

import { supabaseServerWithAuth } from '@/lib/supabase/server-auth';

export async function updateTutorDegree(formData: FormData) {
  const degree = (formData.get('degree') as string)?.trim() || null;

  const supa = supabaseServerWithAuth();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { error } = await supa
    .from('profiles')
    .update({ degree })
    .eq('id', user.id);

  if (error) throw error;

  return { ok: true };
}
