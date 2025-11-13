export type ProfileRole = 'student' | 'tutor';
export type TutorMode = 'visio' | 'presentiel';

export interface ProfilePayloadInput {
  id: string | null | undefined;
  role: string | null | undefined;
  full_name?: string | null | undefined;
  email?: string | null | undefined;
  level?: string | null | undefined;
  university?: string | null | undefined;
  degree?: string | null | undefined;
  subjects?: string[] | null | undefined;
  subject_slugs?: string[] | null | undefined;
  availability_codes?: string[] | null | undefined;
  modes?: (TutorMode | string)[] | null | undefined;
  experience?: string | null | undefined;
}

export interface ProfilePayload {
  id: string;
  role: ProfileRole;
  full_name: string | null;
  email: string | null;
  level: string | null;
  university: string | null;
  degree: string | null;
  subjects: string[];
  subject_slugs: string[];
  availability_codes: string[] | null;
  modes: TutorMode[] | null;
  experience: string | null;
}

export class ProfileSanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileSanitizationError';
  }
}

const cleanString = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const dedupe = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

const ensureStringArray = (value: string[] | null | undefined) => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v): v is string => v.length > 0);
  return dedupe(normalized);
};

const ensureNullableStringArray = (value: string[] | null | undefined) => {
  const arr = ensureStringArray(value);
  return arr.length > 0 ? arr : null;
};

const ensureTutorModes = (value: (TutorMode | string)[] | null | undefined) => {
  if (!Array.isArray(value)) return null;
  const filtered = value.filter((v): v is TutorMode => v === 'visio' || v === 'presentiel');
  if (filtered.length === 0) return null;
  return dedupe(filtered);
};

export function sanitizeProfilePayload(input: ProfilePayloadInput): ProfilePayload {
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id) throw new ProfileSanitizationError('Invalid id provided');

  const rawRole = typeof input.role === 'string' ? input.role.trim() : '';
  if (rawRole !== 'student' && rawRole !== 'tutor') {
    throw new ProfileSanitizationError('Invalid role provided');
  }

  return {
    id,
    role: rawRole,
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
  };
}
