'use server'

import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

export async function createRequestAction(form: FormData) {
  const supa = supabaseServer()
  const { data: { user }, error: au } = await supa.auth.getUser()
  if (au || !user) throw new Error('Non authentifié')

  const payload = {
    student_id: user.id,
    subject: String(form.get('subject') ?? ''),
    level: String(form.get('level') ?? ''),
    mode: (form.get('mode') as 'visio' | 'presentiel') ?? 'visio',
    slots: JSON.parse(String(form.get('time_slots') ?? '[]')), // 🟢 corrigé ici
    status: 'open',
  }

  const { error } = await supa.from('requests').insert(payload)
  if (error) throw new Error(error.message)

  redirect('/dashboard/student')
}
