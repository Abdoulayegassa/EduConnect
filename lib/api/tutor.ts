export async function listTutors(subject?: string) { /* GET /api/tutors?subject=... */ }
export async function getTutorAvailability(tutorId: string, fromISO: string, toISO: string, subjectId?: number) {
  /* GET /api/tutors/[id]/availability?from&to&subjectId */
}
export async function getTutorRoom(tutorId: string) { /* GET /api/tutors/[id]/room */ }
