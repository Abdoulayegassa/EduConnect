// app/api/profile/route.ts
import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/server'

type TutorMode = 'visio' | 'presentiel'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      id,
      role,
      full_name,
      email,
      level,
      university,
      degree,
      subjects,
      subject_slugs,
      availability_codes,
      modes,
      experience,
    } = body ?? {}

    if (!id || !role) {
      return NextResponse.json(
        { ok: false, error: 'Missing id or role' },
        { status: 400 }
      )
    }

    const cleanString = (value: unknown) => {
      if (typeof value !== 'string') return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }

    const ensureStringArray = (value: unknown) =>
      Array.isArray(value)
        ? value
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter((v): v is string => v.length > 0)
        : []

    const ensureNullableStringArray = (value: unknown) => {
      if (!Array.isArray(value)) return null
      const filtered = value
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v): v is string => v.length > 0)
      return filtered.length > 0 ? filtered : null
    }

    const ensureTutorModes = (value: unknown) =>
      Array.isArray(value)
        ? (value.filter((v): v is TutorMode => v === 'visio' || v === 'presentiel') as TutorMode[])
        : null

    const payload = {
      id,
      role,
      full_name: cleanString(full_name),
      email: cleanString(email),
      level: cleanString(level),
      university: cleanString(university),
      degree: cleanString(degree),
      subjects: ensureStringArray(subjects),
      subject_slugs: ensureStringArray(subject_slugs),
      availability_codes: ensureNullableStringArray(availability_codes),
      modes: ensureTutorModes(modes),
      experience: cleanString(experience),
    }

    const supabaseAdmin = createServiceClient()

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
