// app/api/jobs/session-reminders-email/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { Resend } from "resend";

const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM || "EduConnect <noreply@educonnect.ml>";

function checkAuth(req: Request): boolean {
  const header = req.headers.get("x-cron-secret") || "";
  return !!CRON_SECRET && header === CRON_SECRET;
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY manquant côté serveur" },
      { status: 500 }
    );
  }

  const supa = supabaseServer();

  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);

    const nowIso = now.toISOString();
    const in30Iso = in30.toISOString();

    // 1) Récupérer les sessions qui commencent dans 30 min
    const { data: sessions, error: eSess } = await supa
      .from("sessions")
      .select("id, starts_at, jitsi_link, request_id, match_id")
      .gte("starts_at", nowIso)
      .lte("starts_at", in30Iso)
      .limit(100);

    if (eSess) {
      console.error("[session-reminders-email] sessions error", eSess);
      return NextResponse.json({ error: eSess.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ processed: 0, reminded: 0, skipped: 0 });
    }

    const sessionIds = sessions.map((s) => s.id);

    // 2) Vérifier les sessions déjà rappelées (session_reminder_log)
    const { data: logs, error: eLogs } = await supa
      .from("session_reminder_log")
      .select("session_id")
      .in("session_id", sessionIds);

    if (eLogs) {
      console.error("[session-reminders-email] logs error", eLogs);
      return NextResponse.json({ error: eLogs.message }, { status: 500 });
    }

    const alreadyReminded = new Set(
      (logs ?? []).map((l) => l.session_id as string)
    );
    const toRemind = sessions.filter((s) => !alreadyReminded.has(s.id));

    if (toRemind.length === 0) {
      return NextResponse.json({
        processed: sessions.length,
        reminded: 0,
        skipped: sessions.length,
      });
    }

    let reminded = 0;
    let skipped = 0;

    for (const s of toRemind) {
      // 3) Charger la request (subject + student_id)
      const { data: reqRow, error: eReq } = await supa
        .from("requests")
        .select("id, subject, student_id")
        .eq("id", s.request_id)
        .maybeSingle();

      if (eReq || !reqRow) {
        console.warn(
          "[session-reminders-email] request not found for session",
          s.id,
          eReq?.message
        );
        skipped++;
        continue;
      }

      // 4) Charger le match (tutor_id)
      const { data: matchRow, error: eMatch } = await supa
        .from("matches")
        .select("id, tutor_id")
        .eq("id", s.match_id)
        .maybeSingle();

      if (eMatch || !matchRow) {
        console.warn(
          "[session-reminders-email] match not found for session",
          s.id,
          eMatch?.message
        );
        skipped++;
        continue;
      }

      const subject = reqRow.subject || "votre session";
      const startsAt = s.starts_at;
      const jitsi = s.jitsi_link;

      // 5) Fonction utilitaire d'envoi email à un profil
      const sendReminderEmailToProfile = async (
        userId: string,
        role: "student" | "tutor"
      ) => {
        const { data: profile, error: eProf } = await supa
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", userId)
          .maybeSingle();

        if (eProf || !profile) {
          console.warn(
            "[session-reminders-email] profile not found",
            role,
            userId,
            eProf?.message
          );
          return false;
        }

        const to = profile.email as string | null;
        if (!to) {
          console.warn("[session-reminders-email] no email for", role, userId);
          return false;
        }

        const fullName: string | null = profile.full_name || null;
        const firstName = fullName ? fullName.split(" ")[0] : null;

        const greeting = `Bonjour${firstName ? " " + firstName : ""},`;

        let intro = "";
        if (role === "student") {
          intro = `
            Petit rappel ⏰<br/>
            Ta session de soutien en <strong>${subject}</strong> va commencer dans environ <strong>30 minutes</strong>.
          `;
        } else {
          intro = `
            Petit rappel ⏰<br/>
            Votre session de soutien en <strong>${subject}</strong> avec un élève va commencer dans environ <strong>30 minutes</strong>.
          `;
        }

        let details = "";
        if (startsAt) {
          details += `<p><strong>Heure prévue (UTC) :</strong> ${startsAt}</p>`;
        }
        if (jitsi) {
          details += `<p><strong>Lien de connexion :</strong> <a href="${jitsi}" target="_blank" rel="noreferrer">${jitsi}</a></p>`;
        }

        const emailSubject =
          role === "student"
            ? `Rappel : ta session en ${subject} commence bientôt`
            : `Rappel : votre session de soutien en ${subject} commence bientôt`;

        const html = `
          <div style="
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            color: #111827;
            line-height: 1.5;
          ">
            <p>${greeting}</p>
            <p>${intro}</p>
            ${details || ""}
            <p>
              Merci de te connecter quelques minutes en avance pour vérifier ton son, ta caméra et ta connexion.
            </p>
            <p style="margin-top: 16px;">
              À tout à l'heure sur <strong>EduConnect</strong> 👋
            </p>
            <p style="margin-top: 16px; font-size: 12px; color: #6B7280;">
              — L'équipe EduConnect
            </p>
          </div>
        `;

        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to,
            subject: emailSubject,
            html,
          });
          return true;
        } catch (e: any) {
          console.error(
            "[session-reminders-email] resend error",
            role,
            userId,
            e?.message
          );
          return false;
        }
      };

      const okStudent = await sendReminderEmailToProfile(
        reqRow.student_id as string,
        "student"
      );
      const okTutor = await sendReminderEmailToProfile(
        matchRow.tutor_id as string,
        "tutor"
      );

      if (okStudent || okTutor) {
        reminded++;

        // 6) Log pour ne plus renvoyer ce rappel
        await supa.from("session_reminder_log").insert({
          session_id: s.id,
        });

        // 7) (optionnel) notifications in-app
        await supa.from("notifications").insert([
          {
            user_id: reqRow.student_id,
            kind: "session_reminder_student",
            delivered: true,
            payload: {
              session_id: s.id,
              subject,
              starts_at: startsAt,
              jitsi_link: jitsi,
            },
            meta: { via: "email" },
          },
          {
            user_id: matchRow.tutor_id,
            kind: "session_reminder_tutor",
            delivered: true,
            payload: {
              session_id: s.id,
              subject,
              starts_at: startsAt,
              jitsi_link: jitsi,
            },
            meta: { via: "email" },
          },
        ]);
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      processed: sessions.length,
      reminded,
      skipped,
    });
  } catch (e: any) {
    console.error("[session-reminders-email] error", e);
    return NextResponse.json(
      { error: e?.message || "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
