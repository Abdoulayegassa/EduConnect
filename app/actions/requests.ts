'use server';
import { z } from 'zod';
import { supabaseServerWithAuth } from '@/lib/supabase/server-auth';

const Schema = z.object({
  subject: z.string().min(2, 'Matière trop courte'),
  level: z.string().min(2, 'Niveau requis'),
  mode: z.enum(['visio', 'presentiel']).default('visio'),
  time_slots: z.array(z.string()).min(1, 'Au moins un créneau'),
  request_meta: z.object({
    description: z.string().optional(),
    goals: z.string().optional(),
    duration: z.string().optional(),
  }).partial().optional(),
});

export async function createRequest(input: unknown) {
  const supa = supabaseServerWithAuth();

  // Valide et garantit un fallback propre
  const tmp = Schema.parse(input);
  const parsed = { ...tmp, mode: tmp.mode ?? 'visio' as const };

  const { data: { user }, error: uErr } = await supa.auth.getUser();
  if (uErr) throw uErr;
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supa
    .from('requests')
    .insert({
      student_id: user.id,
      subject: parsed.subject,
      level: parsed.level,
      mode: parsed.mode,                // 'visio' | 'presentiel'
      time_slots: parsed.time_slots,    // jsonb array
      request_meta: parsed.request_meta ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createRequest insert error', error);
    throw new Error(error.message || 'Erreur lors de la création de la demande');
  }

  return data; // { id }
}
