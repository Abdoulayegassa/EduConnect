// app/api/profile/route.ts
import { NextResponse } from 'next/server';

import {
  ProfileSanitizationError,
  sanitizeProfilePayload,
  type ProfilePayloadInput,
} from '@/lib/profile/sanitize';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body: ProfilePayloadInput = (await req.json().catch(() => ({}))) as ProfilePayloadInput;

    const payload = sanitizeProfilePayload(body);

    const supabaseAdmin = createServiceClient();

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      // On remonte l'erreur brute pour debug immédiat
      return NextResponse.json(
        { ok: false, error: `[upsert profiles] ${error.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof ProfileSanitizationError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: `[api/profile] ${e?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }
}
