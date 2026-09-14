/** Time & duration formatting helpers. */

// Force English formatting so the (English) UI stays consistent regardless of
// the device's OS locale.
const LOCALE = 'en';

/** A local clock time at a given IANA timezone, e.g. "8:13 PM". */
export function formatClock(date: Date, tzid: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tzid,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
}

/** A weekday + date at a given timezone, e.g. "Tue, Sep 15". */
export function formatDay(date: Date, tzid?: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: tzid,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }
}

export type Parts = { neg: boolean; days: number; h: number; m: number; s: number };

export function splitDuration(ms: number): Parts {
  const neg = ms < 0;
  let t = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(t / 86400);
  t -= days * 86400;
  const h = Math.floor(t / 3600);
  t -= h * 3600;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return { neg, days, h, m, s };
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** "07:42:15", or "1:07:42:15" when a day or more remains. */
export function formatCountdown(ms: number): string {
  const { days, h, m, s } = splitDuration(ms);
  const hh = days > 0 ? `${days}:${p2(h)}` : String(h);
  return `${days > 0 ? hh : p2(h)}:${p2(m)}:${p2(s)}`;
}

/** Coarser phrasing for far-off events, e.g. "in 3 days" / "in 5 hours". */
export function formatUntil(ms: number): string {
  const { days, h, m } = splitDuration(ms);
  if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`;
  if (h >= 1) return `in ${h} hour${h === 1 ? '' : 's'}`;
  return `in ${Math.max(1, m)} minute${m === 1 ? '' : 's'}`;
}
