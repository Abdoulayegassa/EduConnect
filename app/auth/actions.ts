'use server';
import { createServiceClient } from '@/lib/supabase/server';

// Crée/complète le profil côté serveur (bypass RLS via service role)
type TutorMode = 'visio' | 'presentiel';

export async function createProfileServer(input: {
  id: string;
  role: 'student' | 'tutor';
  full_name?: string | null;
  email?: string | null;
  level?: string | null;
  university?: string | null;
  degree?: string | null;
  subjects?: string[] | null;
  subject_slugs?: string[] | null;
  availability_codes?: string[] | null;
  modes?: TutorMode[] | null;
  experience?: string | null;
}) {
  const supa = createServiceClient();

  const cleanString = (value: string | null | undefined) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const ensureStringArray = (value: string[] | null | undefined) =>
    Array.isArray(value)
      ? value
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v): v is string => v.length > 0)
      : [];

  const ensureNullableStringArray = (value: string[] | null | undefined) => {
    if (!Array.isArray(value)) return null;
    const filtered = value
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v): v is string => v.length > 0);
    return filtered.length > 0 ? filtered : null;
  };

  const ensureTutorModes = (value: TutorMode[] | null | undefined) =>
    Array.isArray(value)
      ? value.filter((v): v is TutorMode => v === 'visio' || v === 'presentiel')
      : null;

  // upsert pour éviter l'erreur si le profil existe déjà
  const { error } = await supa
    .from('profiles')
    .upsert({
      id: input.id,
      role: input.role,
      full_name: cleanString(input.full_name ?? null),
      email: cleanString(input.email ?? null),
      level: cleanString(input.level ?? null),
      university: cleanString(input.university ?? null),
      degree: cleanString(input.degree ?? null),
      subjects: ensureStringArray(input.subjects ?? null),
      subject_slugs: ensureStringArray(input.subject_slugs ?? null),
      availability_codes: ensureNullableStringArray(input.availability_codes ?? null),
      modes: ensureTutorModes(input.modes ?? null),
      experience: cleanString(input.experience ?? null),
    }, { onConflict: 'id' });

  if (error) throw error;
  return { ok: true };
}
