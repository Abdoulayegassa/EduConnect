import { useEffect, useMemo, useRef, useState } from "react";

export type Mode = "visio" | "presentiel";

export type InstantMatchQuery = {
  subject?: string;
  mode?: Mode;
  slotCodes?: string[]; // ex: ["wed:evening", "sun:morning"]
};

export type InstantTutor = {
  id: string;
  full_name: string | null;
  subjects: string[] | null;
  hourly_rate?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  next_availabilities?: string[] | null; // ISO[]
};

const debounce = (fn: (...a:any[])=>void, ms=280) => {
  let t:any; return (...a:any[]) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
};

export function useInstantMatch(q: InstantMatchQuery) {
  const [loading, setLoading] = useState(false);
  const [data, setData]     = useState<InstantTutor[]>([]);
  const [error, setError]   = useState<string|null>(null);
  const lastQS = useRef("");

  const run = useMemo(() => debounce(async (payload: InstantMatchQuery) => {
    const subject   = (payload.subject || "").trim();
    const mode      = payload.mode || "";
    const slotCodes = (payload.slotCodes || []).join(",");

    if (!subject && !mode && !slotCodes) { setData([]); return; }

    const qs = new URLSearchParams({ subject, mode, slots: slotCodes }).toString();
    lastQS.current = qs;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/match?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setData(Array.isArray(j?.tutors) ? j.tutors : []);
    } catch (e:any) {
      setError(e?.message || "MATCH_ERROR");
    } finally {
      setLoading(false);
    }
  }, 280), []);

  useEffect(() => {
    run(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.subject, q.mode, JSON.stringify(q.slotCodes)]);

  return { loading, data, error } as const;
}
