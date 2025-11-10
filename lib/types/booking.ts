export type BookingStatus = 'pending'|'confirmed'|'cancelled'|'completed'|'no_show';

export type Booking = {
  id: number;
  tutor_id: string;
  student_id: string;
  subject_id: number;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  status: BookingStatus;
  price_cents?: number | null;
  notes?: string | null;
  tutor?: { full_name?: string | null; room_url?: string | null } | null;
  student?: { full_name?: string | null } | null;
};
