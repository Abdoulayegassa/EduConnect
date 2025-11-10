// app/api/profile/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ⚠️ Utilise les variables SERVEUR (non "NEXT_PUBLIC")
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.warn('[api/profile] Missing SUPABASE_URL or SERVICE_ROLE key')
}

const supabaseAdmin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { id, role, full_name, level, subjects } = body ?? {}

    if (!id || !role) {
      return NextResponse.json(
        { ok: false, error: 'Missing id or role' },
        { status: 400 }
      )
    }

    const payload = {
      id,
      role,
      full_name: full_name ?? null,
      level: level ?? null,
      subjects: Array.isArray(subjects) ? subjects : [],
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      // On remonte l'erreur brute pour debug immédiat
      return NextResponse.json(
        { ok: false, error: `[upsert profiles] ${error.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `[api/profile] ${e?.message ?? 'unknown'}` },
      { status: 500 }
    )
  }
}
