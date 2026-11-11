/** Lagos is UTC+1 all year, so a cutoff "date" means the end of that day at 23:59:59 WAT. */
export const cutoffInstant = (isoDate: string) => new Date(`${isoDate}T23:59:59+01:00`);

export type CutoffStatus =
  | { state: 'open'; msLeft: number; days: number; hours: number; minutes: number; seconds: number }
  | { state: 'passed' };

export function cutoffStatus(isoDate: string | null, now: Date): CutoffStatus {
  if (!isoDate) return { state: 'open', msLeft: Infinity, days: Infinity, hours: 0, minutes: 0, seconds: 0 };
  const msLeft = cutoffInstant(isoDate).getTime() - now.getTime();
  if (msLeft <= 0) return { state: 'passed' };
  const s = Math.floor(msLeft / 1000);
  return { state: 'open', msLeft, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
