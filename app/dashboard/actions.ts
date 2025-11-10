'use server';
import { supabaseServer } from '@/lib/supabase/server';

export async function getMyRequests(userId: string) {
  const supa = supabaseServer();
  const { data, error } = await supa.from('requests').select('*').eq('student_id', userId).order('created_at',{ascending:false});
  if (error) throw error;
  return data;
}

export async function getMyMatches(userId: string, role:'student'|'tutor') {
  const supa = supabaseServer();
  if (role === 'tutor') {
    const { data, error } = await supa.from('matches').select('*, requests(*)').eq('tutor_id', userId).order('created_at',{ascending:false});
    if (error) throw error;
    return data;
  }
  // student
  const { data, error } = await supa
    .from('matches')
    .select('*, requests!inner(*)')
    .eq('requests.student_id', userId)
    .order('created_at',{ascending:false});
  if (error) throw error;
  return data;
}

export async function getMySessions(userId: string) {
  const supa = supabaseServer();
  const { data, error } = await supa
    .from('sessions')
    .select('*, matches!inner(*, requests!inner(student_id))')
    .or(`matches.tutor_id.eq.${userId},matches.requests.student_id.eq.${userId}`)
    .order('starts_at',{ascending:true});
  if (error) throw error;
  return data;
}
