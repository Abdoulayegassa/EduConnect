"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";
import type { AppNotification } from "@/lib/notifications/types";
import { toast } from "sonner";

type Ctx = {
  unread: AppNotification[];
  all: AppNotification[];
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

const NotificationsCtx = createContext<Ctx | null>(null);

export default function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const supa = supabaseBrowser();
  const [userId, setUserId] = useState<string | null>(null);
  const [all, setAll] = useState<AppNotification[]>([]);

  const unread = useMemo(() => all.filter(n => !n.read_at), [all]);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supa.auth.getUser();
    const uid = user?.id ?? null;
    setUserId(uid);
    if (!uid) { setAll([]); return; }

    const { data, error } = await supa
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setAll(data as AppNotification[]);
  }, [supa]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useNotificationsRealtime({
    userId,
    onInsert: (n) => {
      setAll(prev => [n, ...prev]);
      // toast “nouvelle notif”
      const title = n.kind.replace(/_/g, " ").toUpperCase();
      toast(`${title}`, {
        description: n?.payload?.message ?? "Vous avez une nouvelle notification.",
        duration: 5000,
      });
      // Optionnel: petit son
      try {
        const audio = new Audio("/sounds/notify.mp3"); // ajoute ce fichier dans public/sounds
        audio.play().catch(() => {});
      } catch {}
    }
  });

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supa.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (!error) setAll(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }, [supa]);

  const markAllAsRead = useCallback(async () => {
    const ids = all.filter(n => !n.read_at).map(n => n.id);
    if (ids.length === 0) return;
    const { error } = await supa.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (!error) setAll(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }, [supa, all]);

  const value = useMemo<Ctx>(() => ({
    unread, all, markAsRead, markAllAsRead, refresh
  }), [unread, all, markAsRead, markAllAsRead, refresh]);

  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsCtx);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationsProvider />");
  return ctx;
}
