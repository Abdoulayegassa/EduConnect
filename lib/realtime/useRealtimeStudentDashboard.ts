// lib/realtime/useRealtimeStudentDashboard.ts
"use client";
import { useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type SubOpts = {
  requestIds: string[];     // les requêtes de l’élève à suivre
  onChange: () => void;     // callback: refetch overview
};

export function useRealtimeStudentDashboard({ requestIds, onChange }: SubOpts) {
  const supa = useMemo(() => supabaseBrowser(), []);

  useEffect(() => {
    if (!requestIds?.length) return;

    // Filtre PostgREST pour IN (id1,id2,...) — max ~1000 ids; ici on suit les dernières 5 requests
    const filter = `request_id=in.(${requestIds.map((id) => `"${id}"`).join(",")})`;

    // Matches
    const chMatches = supa
      .channel(`student-matches-${requestIds[0]}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter },
        () => onChange()
      )
      .subscribe();

    // Sessions
    const chSessions = supa
      .channel(`student-sessions-${requestIds[0]}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter },
        () => onChange()
      )
      .subscribe();

    return () => {
      supa.removeChannel(chMatches);
      supa.removeChannel(chSessions);
    };
  }, [supa, requestIds, onChange]);
}
