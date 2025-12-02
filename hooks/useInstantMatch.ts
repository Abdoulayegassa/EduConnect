// hooks/useInstantMatch.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InstantTutor } from "@/lib/matching/types";

type UseInstantMatchInput = {
  subject: string;
  mode?: string;         // gardé pour compatibilité, mais visio-only
  slotCodes?: string[];  // ex: ["wed:evening", "sun:morning"]
  debounceMs?: number;
};

type UseInstantMatchState = {
  loading: boolean;
  data: InstantTutor[] | null;
  error: string | null;
};

// Cache temporaire en mémoire (10s)
const CACHE_TTL_MS = 10_000;
const matchCache = new Map<
  string,
  { data: InstantTutor[]; ts: number }
>();

export function useInstantMatch({
  subject,
  mode = "visio",
  slotCodes = [],
  debounceMs = 300,
}: UseInstantMatchInput): UseInstantMatchState {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InstantTutor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchIdRef = useRef(0);

  const stableParams = useMemo(() => {
    const trimmed = (subject || "").trim();
    const normalizedSlots = [...slotCodes].sort();

    return {
      subject: trimmed,
      mode,
      normalizedSlots,
      cacheKey: JSON.stringify({
        s: trimmed,
        m: mode,
        slots: normalizedSlots,
      }),
    };
  }, [subject, mode, slotCodes]);

  useEffect(() => {
    const { subject, mode, normalizedSlots, cacheKey } = stableParams;

    // Nettoyage timer quand les params changent
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Pas de sujet → pas d'appel API
    if (!subject) {
      setLoading(false);
      setData((prev) => (prev === null ? [] : prev));
      setError(null);
      return;
    }

    // Check cache
    const now = Date.now();
    const cached = matchCache.get(cacheKey);

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      setLoading(false);
      setData(cached.data);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const fetchId = ++lastFetchIdRef.current;

    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("subject", subject);
        if (mode) params.set("mode", mode);
        if (normalizedSlots.length > 0) {
          params.set("slots", normalizedSlots.join(","));
        }

        const res = await fetch(`/api/match?${params.toString()}`);

        let json: any = {};
        try {
          json = await res.json();
        } catch {}

        if (fetchId !== lastFetchIdRef.current) return;

        if (!res.ok) {
          const msg = json?.error || json?.warn || `HTTP ${res.status}`;
          setError(msg);
          setData([]);
          setLoading(false);
          return;
        }

        const tutors = Array.isArray(json.tutors)
          ? (json.tutors as InstantTutor[])
          : [];

        matchCache.set(cacheKey, { data: tutors, ts: Date.now() });

        setData(tutors);
        setError(null);
        setLoading(false);
      } catch (e: any) {
        if (fetchId !== lastFetchIdRef.current) return;
        setError(e?.message ?? "Erreur de matching");
        setData([]);
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [stableParams, debounceMs]);

  return { loading, data, error };
}
