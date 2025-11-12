// lib/realtime/useNotifications.ts
"use client";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useNotifications(onNew: (n:any)=>void) {
  useEffect(() => {
    const supa = supabaseBrowser();
    const ch = supa
      .channel('realtime-notifs')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => onNew?.(payload.new)
      )
      .subscribe();
    return () => { supa.removeChannel(ch); };
  }, [onNew]);
}
