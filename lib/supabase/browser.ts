import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function supabaseBrowser() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 🔎 LOG DEBUG
  console.log('[supabaseBrowser] URL defined =', !!url, ' ANON defined =', !!anon);

  if (!url || !anon) {
    // Ne surtout pas throw → ça casserait tout le rendu.
    console.error('[supabaseBrowser] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    throw new Error('Supabase non configuré en local');
  }

  _client = createBrowserClient(url, anon, {
    auth: {
      storageKey: 'sb-educonnect-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}
