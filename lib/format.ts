import { intlLocale, type Lang } from './i18n';

/** Time & duration formatting helpers. */

/** A local clock time at a given IANA timezone, e.g. "8:13 PM" / "20:13". */
export function formatClock(date: Date, tzid: string, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(lang), {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tzid,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(intlLocale(lang), { hour: 'numeric', minute: '2-digit' }).format(date);
  }
}

/** A weekday + date at a given timezone, e.g. "Tue, Sep 15". */
export function formatDay(date: Date, tzid: string | undefined, lang: Lang): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: tzid,
  };
  try {
    return new Intl.DateTimeFormat(intlLocale(lang), opts).format(date);
  } catch {
    return new Intl.DateTimeFormat(intlLocale(lang), { ...opts, timeZone: undefined }).format(date);
  }
}

/** A full date, e.g. "Mon, Sep 14, 2026". */
export function formatFullDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
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

/** "07:42:15", or "1:07:42:15" when a day or more remains. (Always LTR digits.) */
export function formatCountdown(ms: number): string {
  const { days, h, m, s } = splitDuration(ms);
  if (days > 0) return `${days}:${p2(h)}:${p2(m)}:${p2(s)}`;
  return `${p2(h)}:${p2(m)}:${p2(s)}`;
}

/** Coarser phrasing for far-off events, localized (e.g. "in 3 days" / "בעוד 3 ימים"). */
export function formatUntil(ms: number, lang: Lang): string {
  const { days, h, m } = splitDuration(ms);
  const inWord = lang === 'he' ? 'בעוד' : 'in';
  let n: number;
  let unit: string;
  if (days >= 1) {
    n = days;
    unit = lang === 'he' ? (days === 1 ? 'יום' : 'ימים') : days === 1 ? 'day' : 'days';
  } else if (h >= 1) {
    n = h;
    unit = lang === 'he' ? (h === 1 ? 'שעה' : 'שעות') : h === 1 ? 'hour' : 'hours';
  } else {
    n = Math.max(1, m);
    unit = lang === 'he' ? (n === 1 ? 'דקה' : 'דקות') : n === 1 ? 'minute' : 'minutes';
  }
  return `${inWord} ${n} ${unit}`;
}
