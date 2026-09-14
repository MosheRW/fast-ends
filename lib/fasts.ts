import { HebrewCalendar, HDate, Zmanim, flags, Location } from '@hebcal/core';
import type { Lang } from './i18n';

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

type Bi = { he: string; en: string };

// hebcal's stable English `desc` -> bilingual display name.
const FAST_NAMES: Record<string, Bi> = {
  'Tzom Gedaliah': { he: 'צום גדליה', en: 'Fast of Gedaliah' },
  "Asara B'Tevet": { he: 'עשרה בטבת', en: 'Tenth of Tevet' },
  "Ta'anit Esther": { he: 'תענית אסתר', en: 'Fast of Esther' },
  "Ta'anit Bechorot": { he: 'תענית בכורות', en: 'Fast of the Firstborn' },
  'Tzom Tammuz': { he: 'שבעה עשר בתמוז', en: 'Seventeenth of Tammuz' },
  "Tish'a B'Av": { he: 'תשעה באב', en: "Tisha B'Av" },
  'Yom Kippur': { he: 'יום כיפור', en: 'Yom Kippur' },
};

export function fastName(desc: string, lang: Lang): string {
  const n = FAST_NAMES[desc];
  return n ? n[lang] : desc;
}

/** A halachic opinion for when nightfall (tzeit / end of fast) occurs. */
export type TzeitOpinion = {
  id: string;
  short: Bi;
  label: Bi;
  note: Bi;
  compute: (z: Zmanim) => Date;
};

export const OPINIONS: TzeitOpinion[] = [
  {
    id: 'deg18',
    short: { he: '18°', en: '18°' },
    label: { he: '18°', en: '18°' },
    note: {
      he: 'השמש 18° מתחת לאופק.',
      en: 'Sun 18° below the horizon.',
    },
    compute: (z) => z.tzeit(18),
  },
  {
    id: 'deg645',
    short: { he: '6.45°', en: '6.45°' },
    label: { he: '6.45°', en: '6.45°' },
    note: {
      he: 'השמש 6.45° מתחת לאופק.',
      en: 'Sun 6.45° below the horizon.',
    },
    compute: (z) => z.tzeit(6.45),
  },
  {
    id: 'rt72',
    short: { he: 'רבנו תם', en: 'Rabbeinu Tam' },
    label: { he: 'רבנו תם · 72 דק׳', en: 'Rabbeinu Tam · 72 min' },
    note: {
      he: 'רבנו תם — 72 דקות אחרי השקיעה.',
      en: 'Rabbeinu Tam — 72 minutes after sunset.',
    },
    compute: (z) => z.sunsetOffset(72, true),
  },
];

export const DEFAULT_OPINION = 'deg18';

export function opinionById(id: string): TzeitOpinion {
  return OPINIONS.find((o) => o.id === id) ?? OPINIONS[0];
}

/** Localized display text for an opinion id. */
export function opinionText(id: string, lang: Lang): { short: string; label: string; note: string } {
  const o = opinionById(id);
  return { short: o.short[lang], label: o.label[lang], note: o.note[lang] };
}

export type FastEnd = { id: string; time: Date };

export type FastOccurrence = {
  key: string;
  desc: string;
  hebrew: Bi;
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

    const ends: FastEnd[] = OPINIONS.map((o) => ({ id: o.id, time: o.compute(dayZ) })).sort(
      (a, b) => a.time.getTime() - b.time.getTime(),
    );

    out.push({
      key: `${desc}-${gregDate.toISOString().slice(0, 10)}`,
      desc,
      // Hebrew date always in Hebrew letters (gematriya), never Arabic numerals.
      hebrew: { he: ev.getDate().renderGematriya(true), en: ev.getDate().render('en') },
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

/**
 * Today's Hebrew date. In Hebrew it uses Hebrew letters (gematriya), e.g.
 * "ג׳ תשרי תשפ״ז" — never Arabic numerals.
 */
export function hebrewDateString(now: Date, lang: Lang): string {
  const hd = new HDate(now);
  return lang === 'he' ? hd.renderGematriya(true) : hd.render('en');
}

/** Sunset & nightfall (primary opinion) for a plain, non-fast day. */
export function sunTimes(loc: Location, now: Date, opinionId: string) {
  const z = new Zmanim(loc, now, false);
  return { sunset: z.sunset(), nightfall: opinionById(opinionId).compute(z) };
}

// ---- Date-only helpers for the static, location-independent reference table ----

export type FastDateInfo = {
  desc: string;
  hebrew: Bi;
  gregDate: Date;
  isMajor: boolean;
};

export function getFastDates(from: Date, to: Date): FastDateInfo[] {
  const out: FastDateInfo[] = [];
  for (const ev of fastEvents(from, to)) {
    out.push({
      desc: ev.getDesc(),
      hebrew: { he: ev.getDate().renderGematriya(true), en: ev.getDate().render('en') },
      gregDate: ev.getDate().greg(),
      isMajor: Boolean(ev.getFlags() & flags.MAJOR_FAST),
    });
  }
  out.sort((a, b) => a.gregDate.getTime() - b.gregDate.getTime());
  return out;
}
