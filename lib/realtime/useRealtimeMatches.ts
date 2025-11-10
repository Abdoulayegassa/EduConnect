// lib/realtime/useRealtimeMatches.ts
"use client";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Params = {
  onAnyChange?: () => void;
  tutorId?: string;
};

export function useRealtimeMatches({ onAnyChange, tutorId }: Params) {
  const supa = supabaseBrowser();

  useEffect(() => {
    const ch = supa
      .channel("realtime-matching")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          const newRow = (payload?.new ?? {}) as { tutor_id?: string };
          const oldRow = (payload?.old ?? {}) as { tutor_id?: string };
          if (
            !tutorId ||
            newRow.tutor_id === tutorId ||
            oldRow.tutor_id === tutorId
          ) {
            onAnyChange?.();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tutor_availabilities" },
        () => onAnyChange?.()
      )
      .subscribe();

    return () => {
      supa.removeChannel(ch);
    };
  }, [supa, onAnyChange, tutorId]);
}
