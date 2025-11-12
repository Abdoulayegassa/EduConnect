// hooks/useNotifications.ts
'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export type Notif = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  meta: any | null;
  created_at: string;
  seen_at: string | null;
};

export function useNotifications() {
  const supa = useMemo(() => supabaseBrowser(), []);
  const [items, setItems] = useState<Notif[]>([]);
  const [unseen, setUnseen] = useState<number>(0);

  // initial fetch
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/notifications');
      const j = await res.json();
      const list: Notif[] = j.notifications ?? [];
      setItems(list);
      setUnseen(list.filter(n => !n.seen_at).length);
    })();
  }, []);

  // realtime
  useEffect(() => {
    const ch = supa
      .channel('realtime-notifs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        // Supabase accepte un filter string SQL-like:
        // ex: "user_id=eq.<uuid>"
      }, (payload) => {
        const n = payload.new as any;
        if (!n) return;
        setItems(prev => [n as Notif, ...prev].slice(0, 100));
        setUnseen(prev => prev + (n.seen_at ? 0 : 1));
      })
      .subscribe();

    return () => { supa.removeChannel(ch); };
  }, [supa]);

  async function markSeen(ids: string[]) {
    if (!ids.length) return;
    await fetch('/api/notifications/seen', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ ids })
    });
    setItems(prev => prev.map(n => ids.includes(n.id) ? { ...n, seen_at: new Date().toISOString() } : n));
    setUnseen(prev => Math.max(0, prev - ids.length));
  }

  return { items, unseen, markSeen };
}
