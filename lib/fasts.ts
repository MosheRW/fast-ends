import { HebrewCalendar, HDate, Zmanim, flags, Location } from '@hebcal/core';

/**
 * Pure, framework-free fast logic shared by the server (build-time reference
 * table) and the client island (live, location-specific countdown).
 *
 * Tracks the 7 public fasts: Yom Kippur & Tisha B'Av (major, 25hr, begin at
 * sunset the previous evening) and Tzom Gedaliah, Asara B'Tevet, Ta'anit Esther,
 * 17 Tammuz, Ta'anit Bechorot (minor, dawn to nightfall).
 *
 * We rely on hebcal's calendar events so postponed fasts (a fast that would fall
 * on Shabbat is moved) resolve to their correct observed date automatically.
 */

const FAST_MASK = flags.MINOR_FAST | flags.MAJOR_FAST;

// hebcal's stable English `desc` -> friendlier display name.
const DISPLAY: Record<string, string> = {
  'Tzom Gedaliah': 'Fast of Gedaliah',
  "Asara B'Tevet": 'Tenth of Tevet',
  "Ta'anit Esther": 'Fast of Esther',
  "Ta'anit Bechorot": 'Fast of the Firstborn',
  'Tzom Tammuz': 'Seventeenth of Tammuz',
  "Tish'a B'Av": "Tisha B'Av",
  'Yom Kippur': 'Yom Kippur',
};

/** A halachic opinion for when nightfall (tzeit / end of fast) occurs. */
export type TzeitOpinion = {
  id: string;
  short: string;
  label: string;
  note: string;
  compute: (z: Zmanim) => Date;
};

export const OPINIONS: TzeitOpinion[] = [
  {
    id: 'stars3',
    short: '3 stars',
    label: '3 stars · 8.5°',
    note: 'Sun 8.5° below the horizon — three small stars. A common, mainstream tzeit.',
    compute: (z) => z.tzeit(8.5),
  },
  {
    id: 'medium',
    short: '3 medium stars',
    label: '3 medium stars · 7.083°',
    note: 'Sun 7.083° below the horizon — three medium stars (a little earlier).',
    compute: (z) => z.tzeit(7.083),
  },
  {
    id: 'min42',
    short: '42 minutes',
    label: '42 min after sunset',
    note: 'A widely used fixed-time custom: 42 minutes after sunset.',
    compute: (z) => z.sunsetOffset(42, true),
  },
  {
    id: 'rt72',
    short: 'Rabbeinu Tam',
    label: 'Rabbeinu Tam · 72 min',
    note: 'Stringent — 72 minutes after sunset.',
    compute: (z) => z.sunsetOffset(72, true),
  },
];

export const DEFAULT_OPINION = 'stars3';

export function opinionById(id: string): TzeitOpinion {
  return OPINIONS.find((o) => o.id === id) ?? OPINIONS[0];
}

export type FastEnd = {
  id: string;
  short: string;
  label: string;
  note: string;
  time: Date;
};

export type FastOccurrence = {
  key: string;
  name: string;
  hebrewDate: string;
  gregDate: Date;
  isMajor: boolean;
  /** When the fast begins. */
  start: Date;
  /** End time per each opinion, ascending by time. */
  ends: FastEnd[];
  /** Latest opinion's end — the fast is considered fully over after this. */
  windowEnd: Date;
};

/** Iterate the raw fast events in a window, skipping the Erev duplicate. */
function fastEvents(from: Date, to: Date) {
  return HebrewCalendar.calendar({ start: from, end: to, mask: FAST_MASK }).filter((ev) => {
    const m = ev.getFlags();
    return Boolean(m & FAST_MASK) && !(m & flags.EREV);
  });
}

/**
 * Full occurrences (with location-specific start/end times) for the given
 * window. Requires a location because the times depend on it.
 */
export function getFastOccurrences(loc: Location, from: Date, to: Date): FastOccurrence[] {
  const out: FastOccurrence[] = [];
  for (const ev of fastEvents(from, to)) {
    const isMajor = Boolean(ev.getFlags() & flags.MAJOR_FAST);
    const desc = ev.getDesc();
    const gregDate = ev.getDate().greg();
    const dayZ = new Zmanim(loc, gregDate, false);

    let start: Date;
    if (isMajor) {
      // Major fasts begin at sunset the evening before the daytime date.
      const eve = new Date(gregDate);
      eve.setDate(eve.getDate() - 1);
      start = new Zmanim(loc, eve, false).sunset();
    } else {
      // Minor fasts begin at dawn (alot haShachar) on the fast day.
      start = dayZ.alotHaShachar();
    }

    const ends: FastEnd[] = OPINIONS.map((o) => ({
      id: o.id,
      short: o.short,
      label: o.label,
      note: o.note,
      time: o.compute(dayZ),
    })).sort((a, b) => a.time.getTime() - b.time.getTime());

    out.push({
      key: `${desc}-${gregDate.toISOString().slice(0, 10)}`,
      name: DISPLAY[desc] ?? desc,
      hebrewDate: ev.getDate().render('en'),
      gregDate,
      isMajor,
      start,
      ends,
      windowEnd: ends[ends.length - 1].time,
    });
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

export type ViewState =
  | { kind: 'active'; occ: FastOccurrence }
  | { kind: 'pre'; occ: FastOccurrence }
  | { kind: 'none'; next: FastOccurrence | null };

const DAY = 24 * 3600 * 1000;
const PRE_WINDOW_MS = 12 * 3600 * 1000;

/**
 * Pick the view from an already-computed occurrence list. Cheap enough to call
 * every second; the expensive `getFastOccurrences` runs once per location.
 */
export function pickState(occs: FastOccurrence[], now: Date): ViewState {
  const t = now.getTime();
  for (const o of occs) {
    if (t >= o.start.getTime() && t <= o.windowEnd.getTime()) return { kind: 'active', occ: o };
  }
  const next = occs.find((o) => o.start.getTime() > t) ?? null;
  if (next && next.start.getTime() - t <= PRE_WINDOW_MS) return { kind: 'pre', occ: next };
  return { kind: 'none', next };
}

/** Convenience: compute occurrences around `now` and pick the view. */
export function computeState(loc: Location, now: Date): ViewState {
  const occs = getFastOccurrences(loc, new Date(now.getTime() - 2 * DAY), new Date(now.getTime() + 400 * DAY));
  return pickState(occs, now);
}

export const OCCURRENCE_WINDOW = { back: 2 * DAY, forward: 400 * DAY };

/** Today's Hebrew date, e.g. "3rd of Tishrei, 5787". */
export function hebrewDateString(now: Date): string {
  return new HDate(now).render('en');
}

/** Sunset & nightfall (primary opinion) for a plain, non-fast day. */
export function sunTimes(loc: Location, now: Date, opinionId: string) {
  const z = new Zmanim(loc, now, false);
  return { sunset: z.sunset(), nightfall: opinionById(opinionId).compute(z) };
}

// ---- Date-only helpers for the static, location-independent reference table ----

export type FastDateInfo = {
  name: string;
  hebrewDate: string;
  gregDate: Date;
  isMajor: boolean;
};

export function getFastDates(from: Date, to: Date): FastDateInfo[] {
  const out: FastDateInfo[] = [];
  for (const ev of fastEvents(from, to)) {
    out.push({
      name: DISPLAY[ev.getDesc()] ?? ev.getDesc(),
      hebrewDate: ev.getDate().render('en'),
      gregDate: ev.getDate().greg(),
      isMajor: Boolean(ev.getFlags() & flags.MAJOR_FAST),
    });
  }
  out.sort((a, b) => a.gregDate.getTime() - b.gregDate.getTime());
  return out;
}
