import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const slugify = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export async function GET(req: Request) {
  const supa = supabaseServer();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() || "";

  let subjects: { id: number; name: string; slug: string }[] = [];

  // 1) source officielle
  try {
    const { data, error } = await supa
      .from("subjects")
      .select("id, name, slug, enabled")
      .order("name", { ascending: true });

    if (!error && data) {
      subjects = data
        .filter((r: any) => r.enabled !== false)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          slug: r.slug ?? slugify(r.name),
        }));
    }
  } catch {}

  // fallback si vide
  if (!subjects.length) {
    let fromTutors: string[] = [];
    let fromRequests: string[] = [];

    try {
      const { data } = await supa
        .from("profiles")
        .select("role, subjects")
        .eq("role", "tutor")
        .limit(2000);

      fromTutors = (data ?? []).flatMap((t: any) =>
        Array.isArray(t.subjects) ? t.subjects : []
      );
    } catch {}

    try {
      const { data } = await supa
        .from("requests")
        .select("subject")
        .not("subject", "is", null)
        .limit(1000);

      fromRequests = (data ?? [])
        .map((r: any) => r.subject)
        .filter(Boolean);
    } catch {}

    const merged = [...fromTutors, ...fromRequests]
      .map((s) => s.toString().trim())
      .filter(Boolean);

    // dedup
    const map = new Map<string, string>();
    for (const name of merged) {
      const sl = slugify(name);
      if (!map.has(sl)) map.set(sl, name);
    }

    subjects = Array.from(map.entries()).map(([slug, name], i) => ({
      id: i + 1,
      name,
      slug,
    }));
  }

  // filtre search
  let final = subjects;
  if (q) {
    final = final.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q)
    );
  }

  // sorted
  final.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));

  return NextResponse.json({ subjects: final }, { status: 200 });
}
