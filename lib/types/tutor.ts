export type Tutor = {
  id: string;
  full_name: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  subjects?: string[] | null;
  rating?: number | null;
  price_cents?: number | null;
  room_url?: string | null;
};

export type AvailabilityRule = {
  id: number;
  tutor_id: string;
  weekday: number;        // 0..6
  start_minute: number;   // 0..1440
  end_minute: number;     // 1..1440
  timezone: string;
  subject_ids?: number[]; // optionnel
};

export type AvailabilityException = {
  id: number;
  tutor_id: string;
  day: string;            // 'YYYY-MM-DD'
  start_minute?: number | null;
  end_minute?: number | null;
  reason?: string | null;
};

export type Subject = { id: number; name: string };
