import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function supabaseServerWithAuth() {
  const cookieStore = cookies();

  // Compatibilité maximale : on expose à la fois l’API « deprecated » (get/set/remove)
  // et l’API « nouvelle » (getAll/delete). On caste en any pour éviter les erreurs TS.
  const cookieAdapter: any = {
    // --- API DEPRECATED attendue par certaines versions ---
    get(name: string) {
      return cookieStore.get(name)?.value;
    },
    set(name: string, value: string, options?: any) {
      cookieStore.set(name, value, options);
    },
    remove(name: string, options?: any) {
      cookieStore.delete(name);
    },

    // --- API NOUVELLE attendue par d’autres versions ---
    getAll(): { name: string; value: string }[] {
      return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    delete(name: string, options?: any) {
      cookieStore.delete(name);
    },
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // ⚠️ ANON key ici
    { cookies: cookieAdapter }
  );
}
