import { Location } from '@hebcal/core';
import { ISRAELI_CITIES } from './cities';
import type { Lang } from './i18n';

/**
 * A plain, serializable description of a place. We keep this (not a hebcal
 * `Location` instance) in React state and localStorage, and build a `Location`
 * on demand for zmanim math. `name` is an English label; `nameHe` a Hebrew one.
 */
export type StoredLocation = {
  lat: number;
  lon: number;
  tzid: string;
  il: boolean;
  name?: string;
  nameHe?: string;
  mode: 'geo' | 'manual' | 'default';
};

/** Jerusalem — the default so a newcomer always sees a live countdown. */
export const DEFAULT_LOCATION: StoredLocation = {
  lat: 31.7683,
  lon: 35.2137,
  tzid: 'Asia/Jerusalem',
  il: true,
  name: 'Jerusalem',
  nameHe: 'ירושלים',
  mode: 'default',
};

// Rough bounding box of Israel, used only to set the `il` flag when we don't
// otherwise know. `il` barely affects fast dates, so an approximation is fine.
const IL_BBOX = { latMin: 29.4, latMax: 33.4, lonMin: 34.2, lonMax: 35.95 };

export function guessIsrael(lat: number, lon: number, tzid: string): boolean {
  if (tzid === 'Asia/Jerusalem' || tzid === 'Asia/Tel_Aviv') return true;
  return (
    lat >= IL_BBOX.latMin &&
    lat <= IL_BBOX.latMax &&
    lon >= IL_BBOX.lonMin &&
    lon <= IL_BBOX.lonMax
  );
}

/** The device's IANA timezone, best-effort. */
export function deviceTzid(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Build a hebcal `Location` from our plain description. */
export function toLocation(s: StoredLocation): Location {
  return new Location(s.lat, s.lon, s.il, s.tzid, s.name, undefined, undefined, 0);
}

/** From raw coordinates (device geolocation, or manual lat/long entry). */
export function fromCoords(
  lat: number,
  lon: number,
  mode: 'geo' | 'manual',
  name?: string,
): StoredLocation {
  const tzid = deviceTzid();
  return { lat, lon, tzid, il: guessIsrael(lat, lon, tzid), name, mode };
}

/**
 * Resolve a typed query to a location. Order:
 *  1. our Israeli city list (matched by Hebrew or English name)
 *  2. hebcal's built-in international cities
 * Returns null if nothing matches.
 */
export function resolveCity(query: string): StoredLocation | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const il = ISRAELI_CITIES.find(
    (c) => c.he.toLowerCase() === q || c.en.toLowerCase() === q,
  );
  if (il) {
    return {
      lat: il.lat,
      lon: il.lon,
      tzid: 'Asia/Jerusalem',
      il: true,
      name: il.en,
      nameHe: il.he,
      mode: 'manual',
    };
  }

  const loc = Location.lookup(query.trim());
  if (loc) {
    return {
      lat: loc.getLatitude(),
      lon: loc.getLongitude(),
      tzid: loc.getTzid(),
      il: loc.getIsrael(),
      name: loc.getName() ?? query.trim(),
      mode: 'manual',
    };
  }
  return null;
}

/** Human label for the UI, in the chosen language. */
export function locationLabel(s: StoredLocation, lang: Lang): string {
  if (lang === 'he') return s.nameHe ?? s.name ?? coordLabel(s);
  return s.name ?? s.nameHe ?? coordLabel(s);
}

function coordLabel(s: StoredLocation): string {
  return `${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}`;
}

/** hebcal's ~60 built-in "classic" international city names (English). */
const INTL_CITY_NAMES: string[] = [
  'New York', 'Los Angeles', 'Chicago', 'Miami', 'Boston', 'Philadelphia',
  'Baltimore', 'Washington DC', 'Toronto', 'Montreal', 'London', 'Paris',
  'Berlin', 'Moscow', 'Kiev', 'Budapest', 'Helsinki', 'Gibraltar', 'Marseilles',
  'Buenos Aires', 'Sao Paulo', 'Bogota', 'Mexico City', 'Panama City', 'La Paz',
  'Johannesburg', 'Melbourne', 'Sydney', 'Baghdad', 'Hawaii', 'Denver',
  'Houston', 'Dallas', 'Austin', 'Phoenix', 'Las Vegas', 'Seattle', 'Portland',
  'San Francisco', 'San Diego', 'Atlanta', 'Detroit', 'Minneapolis', 'Cleveland',
  'Cincinnati', 'Pittsburgh', 'Saint Louis', 'Omaha', 'Buffalo', 'Providence',
  'Saint Petersburg',
];

/** Options for the location datalist, ordered by language (Israeli first in Hebrew). */
export function cityOptions(lang: Lang): string[] {
  const israeli = ISRAELI_CITIES.map((c) => (lang === 'he' ? c.he : c.en));
  return lang === 'he' ? [...israeli, ...INTL_CITY_NAMES] : [...israeli, ...INTL_CITY_NAMES];
}
