export type Lang = 'he' | 'en';

export const DEFAULT_LANG: Lang = 'he';

export function dirFor(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'he' ? 'rtl' : 'ltr';
}

/** IANA/Intl locale used for date & time formatting. */
export function intlLocale(lang: Lang): string {
  return lang === 'he' ? 'he-IL' : 'en';
}

type Dict = Record<string, string>;

const HE: Dict = {
  brand: 'צאת הצום',
  langOther: 'EN',
  change: 'שינוי',
  useMyLocation: 'השתמש במיקום שלי',
  enterCityLabel: 'הזינו עיר או "קו רוחב, קו אורך"',
  setBtn: 'הגדר',
  placeholder: 'לדוגמה: ירושלים · 31.77, 35.21',
  notFound: 'לא נמצא. נסו עיר מהרשימה, או הזינו "קו רוחב, קו אורך".',
  locating: 'מאתר את מיקומכם…',
  locatingSub: 'אפשרו גישה למיקום לקבלת זמנים לפי מיקומכם.',
  orManual: 'או הזינו מיקום ידנית',
  locUnavailable: 'המיקום אינו זמין',
  enterLocation: 'הזינו מיקום',
  fastInProgress: 'הצום בעיצומו',
  endsIn: 'מסתיים בעוד',
  nightfallAt: 'צאת הכוכבים בשעה {t}',
  comingUp: 'בקרוב',
  fastBeginsIn: 'הצום מתחיל בעוד',
  beginsAt: 'מתחיל {day} בשעה {t}',
  nightfallTimes: 'זמני צאת הכוכבים (סיום הצום):',
  today: 'היום',
  noFastToday: 'אין צום היום',
  sunset: 'שקיעה',
  nightfall: 'צאת הכוכבים',
  nightfallOpinion: 'שיטת צאת הכוכבים:',
  nextFast: 'הצום הבא',
  beginsEndsAround: 'מתחיל בשעה {a} · מסתיים בסביבות {b}',
  fastEnded: 'הצום הסתיים 🌙',
  accordingTo: 'לפי {op}',
  laterOpinion: 'שיטה מאוחרת יותר ({op}) מסתיימת בעוד {cd}.',
  fastBegan: 'הצום התחיל {day} בשעה {t}.',
  disclaimer:
    'הזמנים מחושבים להכוונה בלבד — יש לאמת מול רב/פוסק מקומי. שיטות צאת הכוכבים המוצגות: 13.5 דק׳ לפני צאת 7.083°, ‏6.45°, ורבנו תם (72 דקות). שעון קיץ וגובה עשויים לשנות את הזמנים בכמה דקות.',
  upcomingFasts: 'צומות קרובים',
  upcomingSub:
    'התאריכים זהים בכל מקום; זמני ההתחלה והסיום המדויקים תלויים במיקומכם ומופיעים בספירה החיה למעלה.',
  tagMajor: '25 שעות',
  tagMinor: 'מעלות השחר עד צאת הכוכבים',
  loading: 'טוען…',
  unitsDay: 'ימים',
  unitsDay1: 'יום',
  unitsHour: 'שעות',
  unitsHour1: 'שעה',
  unitsMin: 'דקות',
  unitsMin1: 'דקה',
  inPrefix: 'בעוד',
};

const EN: Dict = {
  brand: 'End of the Fast',
  langOther: 'עב',
  change: 'change',
  useMyLocation: 'Use my location',
  enterCityLabel: 'Enter a city or “latitude, longitude”',
  setBtn: 'Set',
  placeholder: 'e.g. Jerusalem · 40.71, -74.01',
  notFound: 'Not found. Try a listed city, or enter "latitude, longitude".',
  locating: 'Finding your location…',
  locatingSub: 'Allow location access for times based on where you are.',
  orManual: 'Or enter it manually',
  locUnavailable: 'Location unavailable',
  enterLocation: 'Enter a location',
  fastInProgress: 'Fast in progress',
  endsIn: 'Ends in',
  nightfallAt: 'Nightfall at {t}',
  comingUp: 'Coming up',
  fastBeginsIn: 'Fast begins in',
  beginsAt: 'Begins {day} at {t}',
  nightfallTimes: 'Nightfall (end of fast) times:',
  today: 'Today',
  noFastToday: 'No fast today',
  sunset: 'Sunset',
  nightfall: 'Nightfall',
  nightfallOpinion: 'Nightfall opinion:',
  nextFast: 'Next fast',
  beginsEndsAround: 'Begins at {a} · ends around {b}',
  fastEnded: 'The fast has ended 🌙',
  accordingTo: 'According to {op}',
  laterOpinion: 'A later opinion ({op}) ends in {cd}.',
  fastBegan: 'Fast began {day} at {t}.',
  disclaimer:
    'Times are computed for guidance only — confirm with your local halachic authority. Nightfall opinions shown: 13.5 min before 7.083° nightfall, 6.45°, and Rabbeinu Tam (72 minutes). Daylight-saving and elevation can shift times by a few minutes.',
  upcomingFasts: 'Upcoming fasts',
  upcomingSub:
    'Dates are the same everywhere; the exact start and end times depend on your location and appear in the live countdown above.',
  tagMajor: '25 hr',
  tagMinor: 'dawn–nightfall',
  loading: 'Loading…',
  unitsDay: 'days',
  unitsDay1: 'day',
  unitsHour: 'hours',
  unitsHour1: 'hour',
  unitsMin: 'minutes',
  unitsMin1: 'minute',
  inPrefix: 'in',
};

const STRINGS: Record<Lang, Dict> = { he: HE, en: EN };

export function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export type TFunc = (key: keyof typeof EN, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): TFunc {
  return (key, vars) => interpolate(STRINGS[lang][key] ?? STRINGS.en[key] ?? String(key), vars);
}
