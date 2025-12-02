// app/api/jobs/email-dispatch/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { Resend } from "resend";

const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'EduConnect <noreply@educonnect.ml>';

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
    // 1) Récupérer les notifications non délivrées
    const { data: notifs, error: eNotif } = await supa
      .from("notifications")
      .select("id, user_id, kind, delivered, payload, meta")
      .eq("delivered", false)
      .in("kind", ["session_created_student", "session_created_tutor"])
      .limit(50);

    if (eNotif) {
      return NextResponse.json({ error: eNotif.message }, { status: 500 });
    }

    if (!notifs || notifs.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
    }

    let sent = 0;
    let skipped = 0;

    for (const n of notifs) {
      const notifId = n.id as string;
      const userId = n.user_id as string;
      const kind = n.kind as string;
      const payload: any = n.payload || {};
      const meta: any = n.meta || {};

      // 2) Récupérer l’email + nom du profil
      const { data: profile, error: eProf } = await supa
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (eProf || !profile) {
        skipped++;
        await supa
          .from("notifications")
          .update({
            meta: {
              ...meta,
              email_error: eProf?.message || "PROFILE_NOT_FOUND",
            },
          })
          .eq("id", notifId);
        continue;
      }

      const to = profile.email as string | null;
      const fullName: string | null = profile.full_name || null;
      const firstName = fullName ? fullName.split(" ")[0] : null;

      if (!to) {
        skipped++;
        await supa
          .from("notifications")
          .update({
            meta: {
              ...meta,
              email_error: "NO_EMAIL",
            },
          })
          .eq("id", notifId);
        continue;
      }

            const subjectLabel = payload.subject || "votre session";
      const startsAt = payload.starts_at || null;
      const jitsi = payload.jitsi_link || null;

      // 3) Construire sujet + contenu email (version plus humaine)
      let subject = "";
      if (kind === "session_created_student") {
        subject = `Ta session de soutien en ${subjectLabel} est prête ✅`;
      } else if (kind === "session_created_tutor") {
        subject = `Nouvelle session de soutien en ${subjectLabel} 📚`;
      } else {
        subject = `Notification EduConnect`;
      }

      const greeting = `Bonjour${firstName ? " " + firstName : ""},`;

      let intro = "";
      if (kind === "session_created_student") {
        intro = `
          Bonne nouvelle 🎉<br/>
          Ta session de soutien en <strong>${subjectLabel}</strong> vient d’être programmée.
        `;
      } else if (kind === "session_created_tutor") {
        intro = `
          Vous avez une nouvelle session de soutien en <strong>${subjectLabel}</strong> qui vient d’être programmée.
        `;
      } else {
        intro = `
          Voici une nouvelle notification concernant votre compte EduConnect.
        `;
      }

      let details = "";
      if (startsAt) {
        details += `<p><strong>Date & heure (UTC) :</strong> ${startsAt}</p>`;
      }
      if (jitsi) {
        details += `<p><strong>Lien de connexion :</strong> <a href="${jitsi}" target="_blank" rel="noreferrer">${jitsi}</a></p>`;
      }

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
            Pense à préparer ton matériel (connexion Internet, cahier, stylos, exercices) pour profiter au maximum de cette séance.
          </p>
          <p style="margin-top: 16px;">
            Merci d'utiliser <strong>EduConnect</strong> pour organiser tes séances de soutien. 💡
          </p>
          <p style="margin-top: 16px; font-size: 12px; color: #6B7280;">
            — L'équipe EduConnect
          </p>
        </div>
      `;


      // 4) Envoi via Resend
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to,
          subject,
          html,
        });
      } catch (e: any) {
        skipped++;
        await supa
          .from("notifications")
          .update({
            meta: {
              ...meta,
              email_error: e?.message || "RESEND_SEND_ERROR",
            },
          })
          .eq("id", notifId);
        continue;
      }

      // 5) Marquer comme délivré
      sent++;
      await supa
        .from("notifications")
        .update({
          delivered: true,
          meta: {
            ...meta,
            email_sent_at: new Date().toISOString(),
          },
        })
        .eq("id", notifId);
    }

    return NextResponse.json({
      processed: notifs.length,
      sent,
      skipped,
    });
  } catch (e: any) {
    console.error("[email-dispatch] error", e);
    return NextResponse.json(
      { error: e?.message || "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
