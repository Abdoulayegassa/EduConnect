'use server';
import { supabaseServer } from '@/lib/supabase/server';

// Crée/complète le profil côté serveur (bypass RLS via service role)
export async function createProfileServer(input: {
  id: string;
  role: 'student'|'tutor';
  full_name?: string;
  level?: string;
  subjects?: string[];
}) {
  const supa = supabaseServer();

  // upsert pour éviter l'erreur si le profil existe déjà
  const { error } = await supa
    .from('profiles')
    .upsert({
      id: input.id,
      role: input.role,
      full_name: input.full_name ?? null,
      level: input.level ?? null,
      subjects: input.subjects ?? []
    }, { onConflict: 'id' });

  if (error) throw error;
  return { ok: true };
}
