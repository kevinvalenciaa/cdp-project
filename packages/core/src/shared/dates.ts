export const DAY_MS = 86_400_000;

/** Format a Date as 'YYYY-MM-DD' (UTC). */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format a Date as 'YYYY-MM-DD HH:MM:SS' (UTC). */
export function ymdhms(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** Day of year in [1, 366] (UTC). */
export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / DAY_MS) + 1;
}
