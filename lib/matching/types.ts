// /lib/matching/types.ts
import type { Mode } from "./constants";

export type InstantMatchQuery = {
  subject?: string;
  mode?: Mode;
  slotCodes?: string[]; // ex: ["wed:evening", "sun:morning"]
};

export type InstantTutor = {
  id: string;
  full_name: string | null;
  subjects: string[] | null;
  levels?: string[] | null;
  hourly_rate?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  avatar_url?: string | null;
  next_availabilities?: string[] | null; // ISO[]
};
