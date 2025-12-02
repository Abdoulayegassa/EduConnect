import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifier";

const CRON_SECRET = process.env.CRON_SECRET;

function checkAuth(req: Request) {
  return req.headers.get("x-cron-secret") === CRON_SECRET;
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supa = supabaseServer();

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 60 * 1000);

  const { data: sessions } = await supa
    .from("sessions")
    .select("id, starts_at, jitsi_link, request_id, match_id, reminder_sent")
    .eq("reminder_sent", false)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", in30.toISOString());

  if (!sessions?.length) {
    return NextResponse.json({ processed: 0, reminded: 0 });
  }

  let reminded = 0;

  for (const s of sessions) {
    // Request info
    const { data: reqRow } = await supa
      .from("requests")
      .select("subject, student_id")
      .eq("id", s.request_id)
      .maybeSingle();

    if (!reqRow) continue;

    // Tutor info
    const { data: matchRow } = await supa
      .from("matches")
      .select("tutor_id")
      .eq("id", s.match_id)
      .maybeSingle();

    if (!matchRow) continue;

    // Profiles
    const { data: studentProfile } = await supa
      .from("profiles")
      .select("email, full_name")
      .eq("id", reqRow.student_id)
      .maybeSingle();

    const { data: tutorProfile } = await supa
      .from("profiles")
      .select("email, full_name")
      .eq("id", matchRow.tutor_id)
      .maybeSingle();

    const subject = reqRow.subject ?? "votre session";
    const startsAt = s.starts_at;
    const link = s.jitsi_link;

    const html = `
      <p>Bonjour,</p>
      <p>Ceci est un rappel : votre session de soutien en <b>${subject}</b> commence dans environ 30 minutes.</p>
      <p><b>Heure :</b> ${startsAt}</p>
      <p><b>Lien :</b> <a href="${link}">${link}</a></p>
      <p>Merci d'arriver 2–3 min à l'avance.</p>
      <p>L'équipe EduConnect</p>
    `;

    // Send emails
    if (studentProfile?.email) await sendEmail(studentProfile.email, "Rappel de votre session", html);
    if (tutorProfile?.email) await sendEmail(tutorProfile.email, "Rappel de votre session", html);

    await supa.from("sessions").update({ reminder_sent: true }).eq("id", s.id);
    reminded++;
  }

  return NextResponse.json({ processed: sessions.length, reminded });
}
