// /lib/matching/constants.ts
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Pod = "morning" | "afternoon" | "evening";
export type Mode = "visio" | "presentiel";

export const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const PODS: Pod[] = ["morning", "afternoon", "evening"];

export const DAY_LABEL: Record<Day, string> = {
  mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi",
  fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
};
export const POD_LABEL: Record<Pod, string> = {
  morning: "Matin (8h-12h)", afternoon: "Après-midi (12h-18h)", evening: "Soir (18h-22h)",
};

export const keyFor = (day: Day, pod: Pod) => `${day}:${pod}`;

export const WEEK_IDX: Record<Day, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
export const POD_HOUR: Record<Pod, number> = { morning: 9, afternoon: 14, evening: 19 };

export function nextDateForDayPod(day: Day, pod: Pod): Date {
  const now = new Date();
  const target = new Date(now);
  const targetW = WEEK_IDX[day];
  const curW = now.getDay();
  let add = targetW - curW;
  if (add < 0 || (add === 0 && now.getHours() >= POD_HOUR[pod])) add += 7;
  target.setDate(now.getDate() + add);
  target.setHours(POD_HOUR[pod], 0, 0, 0);
  return target;
}
export function toDatetimeLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd}T${hh}:${mi}`;
}
