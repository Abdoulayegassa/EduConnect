'use server';
import { sanitizeProfilePayload, type ProfilePayloadInput } from '@/lib/profile/sanitize';
import { createServiceClient } from '@/lib/supabase/server';

// Crée/complète le profil côté serveur (bypass RLS via service role)
export async function createProfileServer(input: ProfilePayloadInput) {
  const supa = createServiceClient();

  const payload = sanitizeProfilePayload(input);

  // upsert pour éviter l'erreur si le profil existe déjà
  const { error } = await supa
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
  return { ok: true };
}
