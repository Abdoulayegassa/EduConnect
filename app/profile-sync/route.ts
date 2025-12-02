// app/api/profile-sync/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'This endpoint is deprecated and no longer available.',
    },
    { status: 410 },
  );
}
