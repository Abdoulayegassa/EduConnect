// lib/supabase/browser.ts
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// 👇 singleton module-scoped
let _client: SupabaseClient | null = null

export function supabaseBrowser() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // 👇 Donne un storageKey unique pour éviter les collisions si tu avais déjà un autre client
        storageKey: 'sb-educonnect-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
  return _client
}
