export async function createBooking(payload: {
  tutor_id: string; subject_id: number; starts_at: string; ends_at: string; notes?: string;
}) { /* fetch POST /api/bookings */ }

export async function listMyBookings(role: 'student'|'tutor') { /* GET /api/bookings/mine?role=... */ }

export async function acceptBooking(id: number) { /* POST /api/bookings/[id]/accept */ }
export async function cancelBooking(id: number) { /* POST /api/bookings/[id]/cancel */ }
export async function completeBooking(id: number) { /* POST /api/bookings/[id]/complete */ }
