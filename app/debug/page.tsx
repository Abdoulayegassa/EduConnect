// app/debug/page.tsx
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function DebugPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => cookieStore.get(k)?.value } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  let profile: any = null
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    profile = data ?? null
  }

  return (
    <pre style={{ padding: 16, whiteSpace: 'pre-wrap' }}>
      {JSON.stringify({ sessionPresent: !!session, user, profile }, null, 2)}
    </pre>
  )
}
