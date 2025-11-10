// hooks/useInstantMatch.ts
"use client";
import { useEffect, useMemo, useState } from "react";
import type { InstantMatchQuery, InstantTutor } from "@/lib/matching/types";

const debounce = (fn: (...a:any[])=>void, ms=280) => {
  let t:any; return (...a:any[]) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
};

export function useInstantMatch(q: InstantMatchQuery) {
  const [loading, setLoading] = useState(false);
  const [data, setData]     = useState<InstantTutor[]>([]);
  const [error, setError]   = useState<string|null>(null);

  const run = useMemo(() => debounce(async (payload: InstantMatchQuery) => {
    const subject   = (payload.subject || "").trim();
    const mode      = payload.mode || "";
    const slotCodes = (payload.slotCodes || []).join(",");

    if (!subject) { setData([]); return; }

    const qs = new URLSearchParams({ subject, mode, slots: slotCodes }).toString();
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/match?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setData(Array.isArray(j?.tutors) ? j.tutors : []);
    } catch (e:any) {
      setError(e?.message || "MATCH_ERROR");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, 280), []);

  useEffect(() => {
    run(q);
  }, [q.subject, q.mode, run, q]);

  return { loading, data, error } as const;
}
