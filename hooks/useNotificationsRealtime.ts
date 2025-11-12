"use client";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AppNotification } from "@/lib/notifications/types";

type Options = {
  onInsert?: (n: AppNotification) => void;
  userId?: string | null;
};

export function useNotificationsRealtime({ onInsert, userId }: Options) {
  const supa = supabaseBrowser();
  const subRef = useRef<ReturnType<typeof supa.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const ch = supa
      .channel(`rt-notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          onInsert?.(row);
        }
      )
      .subscribe();

    subRef.current = ch;
    return () => {
      if (subRef.current) supa.removeChannel(subRef.current);
    };
  }, [supa, userId, onInsert]);
}
