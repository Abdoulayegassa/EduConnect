// components/TutorMiniCard.tsx
import React from "react";
import type { InstantTutor } from "@/lib/matching/types";

export function TutorMiniCard({
  t,
  onReserve,
}: {
  t: InstantTutor;
  onReserve?: (tutorId: string) => void;
}) {
  const initials = (t.full_name || "??")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-xl border p-3 bg-white flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">
            {t.full_name || "Tuteur"}
          </div>
          <div className="text-[11px] text-gray-600 truncate">
            {(t.subjects || []).slice(0, 3).join(" • ")}
          </div>
        </div>
      </div>
      {onReserve && (
        <button
          onClick={() => onReserve(t.id)}
          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5"
        >
          Réserver
        </button>
      )}
    </div>
  );
}
