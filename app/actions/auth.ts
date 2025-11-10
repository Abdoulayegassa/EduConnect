'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function serverClientFromCookies() {
  const cookieStore = cookies();
  const cookieAdapter: any = {
    get: (name: string) => cookieStore.get(name)?.value,
    set: (name: string, value: string, options?: any) => cookieStore.set(name, value, options),
    remove: (name: string) => cookieStore.delete(name),
    getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
    delete: (name: string) => cookieStore.delete(name),
  };
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter }
  );
}

// 1) Appliquer la session (login/refresh)
export async function applyServerSession(input: {
  access_token: string;
  refresh_token: string;
}) {
  const supa = serverClientFromCookies();
  await supa.auth.setSession({
    access_token: input.access_token,
    refresh_token: input.refresh_token,
  });
  // Optionnel: vérif
  // const {
  //   data: { user },
  // } = await supa.auth.getUser();
  // console.log('server sees user:', user?.id);
  return { ok: true };
}

// 2) Effacer la session (logout)
export async function clearServerSession() {
  const supa = serverClientFromCookies();
  await supa.auth.signOut(); // supprime les cookies auth
  return { ok: true };
}
