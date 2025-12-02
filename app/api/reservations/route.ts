// app/api/reservations/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notifier"; // 👈 NEW

const FIXED_DURATION_MIN = 120; // 2 heures

const BodySchema = z.object({
  requestId: z.string().uuid(),
  tutorId: z.string().uuid(),
  startsAt: z.string().datetime(), // ISO
});

// Helpers pour slot_code cohérent avec la DB
const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DayCode = (typeof DAY_CODES)[number];
type Pod = "morning" | "afternoon" | "evening";

function toDayCode(d: Date): DayCode {
  return DAY_CODES[d.getDay()];
}

function toPod(d: Date): Pod {
  const h = d.getHours();
  if (h >= 18) return "evening";
  if (h >= 12) return "afternoon";
  return "morning";
}

function toSlotCode(d: Date) {
  const day = toDayCode(d);
  const pod = toPod(d);
  return { day, pod, slot_code: `${day}:${pod}` };
}

export async function POST(req: Request) {
  try {
    // 1) Lecture + validation du body
    const json = await (async () => {
      try {
        return await req.json();
      } catch {
        return {};
      }
    })();

    const body = BodySchema.parse(json);
    const supa = supabaseServer();

    // 2) Auth (étudiant connecté)
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    // 3) Charger la request + vérifier propriétaire
    const { data: reqRow, error: eReq } = await supa
      .from("requests")
      .select("id, student_id, mode, subject")
      .eq("id", body.requestId)
      .maybeSingle();

    if (eReq) {
      return NextResponse.json(
        { success: false, error: eReq.message },
        { status: 400 }
      );
    }

    if (!reqRow) {
      return NextResponse.json(
        { success: false, error: "REQUEST_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (reqRow.student_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 4) Récupérer (ou créer) le match correspondant (request_id + tutor_id)
    const { data: existingMatch, error: eMatch } = await supa
      .from("matches")
      .select("id, status, tutor_id, request_id, mode")
      .eq("request_id", reqRow.id)
      .eq("tutor_id", body.tutorId)
      .maybeSingle();

    if (eMatch) {
      return NextResponse.json(
        { success: false, error: eMatch.message },
        { status: 400 }
      );
    }

    let matchRow = existingMatch;

    // 🔹 CAS 1 : aucun match → on le crée en "accepted"
    if (!matchRow) {
      const { data: insertedMatch, error: eInsertMatch } = await supa
        .from("matches")
        .insert({
          request_id: reqRow.id,
          tutor_id: body.tutorId,
          status: "accepted",
          mode: reqRow.mode || "visio",
        })
        .select("id, status, tutor_id, request_id, mode")
        .maybeSingle();

      if (eInsertMatch || !insertedMatch) {
        return NextResponse.json(
          {
            success: false,
            error: eInsertMatch?.message || "MATCH_INSERT_ERROR",
          },
          { status: 400 }
        );
      }

      matchRow = insertedMatch;
    } else {
      // 🔹 CAS 2 : match existe déjà → on gère son statut
      if (matchRow.status === "accepted") {
        // OK
      } else if (matchRow.status === "proposed") {
        const { data: updMatch, error: eUpd } = await supa
          .from("matches")
          .update({
            status: "accepted",
            mode: matchRow.mode || reqRow.mode || "visio",
          })
          .eq("id", matchRow.id)
          .eq("status", "proposed")
          .select("id, status, tutor_id, request_id, mode")
          .maybeSingle();

        if (eUpd) {
          return NextResponse.json(
            { success: false, error: eUpd.message },
            { status: 400 }
          );
        }

        if (!updMatch) {
          return NextResponse.json(
            { success: false, error: "CONFLICT_ALREADY_ACCEPTED" },
            { status: 409 }
          );
        }

        matchRow = updMatch;
      } else {
        return NextResponse.json(
          { success: false, error: "INVALID_MATCH_STATE" },
          { status: 409 }
        );
      }
    }

    // 5) Créer la session liée (ou récupérer si déjà existante)
    const starts = new Date(body.startsAt);
    if (Number.isNaN(starts.getTime())) {
      return NextResponse.json(
        { success: false, error: "INVALID_STARTS_AT" },
        { status: 400 }
      );
    }

    const durationMin = FIXED_DURATION_MIN; // toujours 2h
    const ends = new Date(starts.getTime() + durationMin * 60_000);

    const { slot_code } = toSlotCode(starts);

    const jitsi_link = `https://meet.jit.si/edu-${matchRow.id.slice(
      0,
      8
    )}-${Date.now().toString(36)}`;

    const { data: sess, error: eSess } = await supa
      .from("sessions")
      .insert({
        request_id: matchRow.request_id,
        match_id: matchRow.id,
        student_id: reqRow.student_id, // = auth.uid()
        tutor_id: matchRow.tutor_id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        mode: matchRow.mode || reqRow.mode || "visio",
        slot_code,
        jitsi_link,
      } as any)
      .select("id, starts_at, ends_at, mode, jitsi_link")
      .maybeSingle();

        let sessionRow = sess;

    if (!sessionRow && eSess) {
      const { data: existingSession } = await supa
        .from("sessions")
        .select("id, starts_at, ends_at, mode, jitsi_link")
        .eq("match_id", matchRow.id)
        .maybeSingle();

      if (!existingSession) {
        return NextResponse.json(
          { success: false, error: eSess.message },
          { status: 400 }
        );
      }

      sessionRow = existingSession;
    }

    if (!sessionRow) {
      return NextResponse.json(
        { success: false, error: "SESSION_NOT_CREATED" },
        { status: 500 }
      );
    }

    // ✅ À partir de là, TypeScript sait qu’elle n’est plus nulle
    const session = sessionRow;

    // 6) Consommer la disponibilité du tuteur pour ce slot
     try {
      const del1 = await supa
        .from("tutor_availabilities")
        .delete()
        .match({ tutor_id: matchRow.tutor_id, slot_code })
        .select("tutor_id");

      const deleted1 = Array.isArray(del1.data) ? del1.data.length : 0;

      if (deleted1 === 0) {
        const [day, pod] = slot_code.split(":");
        await supa
          .from("tutor_availabilities")
          .delete()
          .match({ tutor_id: matchRow.tutor_id, day, pod })
          .select("tutor_id");
      }
    } catch (e) {
      console.warn("consume tutor availability (reservations) warning:", e);
    }

    // 7) Emails de confirmation (student + tuteur)
    const subjectLabel = reqRow.subject || "votre séance";
    const emailSubject = `Votre session EduConnect en ${subjectLabel} est programmée`;

    // Récupérer les emails
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

    const formatName = (fullName?: string | null) =>
      fullName?.split(" ")[0] || "Bonjour";

    const htmlTemplate = (role: "Étudiant" | "Tuteur") => `
      <p>${role === "Étudiant" ? "Bonjour" : "Bonjour"} ${
      role === "Étudiant"
        ? formatName(studentProfile?.full_name)
        : formatName(tutorProfile?.full_name)
    },</p>
      <p>Votre session de soutien en <b>${subjectLabel}</b> vient d’être programmée.</p>
      <p><b>Date et heure :</b> ${session.starts_at}</p>
      <p><b>Durée :</b> 2 heures</p>
      <p><b>Mode :</b> ${
        session.mode === "presentiel" ? "Présentiel" : "Visio"
      }</p>
      ${
        session.jitsi_link
          ? `<p><b>Lien de connexion :</b> <a href="${session.jitsi_link}">${session.jitsi_link}</a></p>`
          : ""
      }
      <p>Merci d’être ponctuel(le) et de vous connecter quelques minutes à l’avance.</p>
      <p>L’équipe EduConnect.</p>
    `;

    // Envoi email étudiant
    if (studentProfile?.email) {
      await sendEmail(
        studentProfile.email,
        emailSubject,
        htmlTemplate("Étudiant")
      );
    }

    // Envoi email tuteur
    if (tutorProfile?.email) {
      await sendEmail(
        tutorProfile.email,
        emailSubject,
        htmlTemplate("Tuteur")
      );
    }

    // 8) Notifications internes (centre de notifications UI)
    await supa.from("notifications").insert([
      {
        user_id: reqRow.student_id,
        kind: "session_created_student",
        delivered: true, // email déjà envoyé
        payload: {
          session_id: session.id,
          subject: subjectLabel,
          starts_at: session.starts_at,
          jitsi_link: session.jitsi_link,
        },
        meta: {
          source: "reservations",
          role: "student",
          via: "email",
        },
      },
      {
        user_id: matchRow.tutor_id,
        kind: "session_created_tutor",
        delivered: true,
        payload: {
          session_id: session.id,
          subject: subjectLabel,
          starts_at: session.starts_at,
          jitsi_link: session.jitsi_link,
        },
        meta: {
          source: "reservations",
          role: "tutor",
          via: "email",
        },
      },
    ]);

    return NextResponse.json(
      {
        success: true,
        matchId: matchRow.id,
        session,
      },
      { status: 200 }
    );

    
  } catch (e: any) {
    console.error("reservations POST error", e);
    return NextResponse.json(
      { success: false, error: e?.message ?? "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
