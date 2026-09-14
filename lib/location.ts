import { Location } from '@hebcal/core';

/**
 * A plain, serializable description of a place. We keep this (not a hebcal
 * `Location` instance) in React state and localStorage, and build a `Location`
 * on demand for zmanim math.
 */
export type StoredLocation = {
  lat: number;
  lon: number;
  tzid: string;
  il: boolean;
  name?: string;
  mode: 'geo' | 'manual';
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
 * Look up one of hebcal's ~60 built-in "classic" city names. Offline, no
 * third-party call. Returns null if the name isn't recognized.
 */
export function fromCity(name: string): StoredLocation | null {
  const loc = Location.lookup(name.trim());
  if (!loc) return null;
  return {
    lat: loc.getLatitude(),
    lon: loc.getLongitude(),
    tzid: loc.getTzid(),
    il: loc.getIsrael(),
    name: loc.getName() ?? name,
    mode: 'manual',
  };
}

/** Human label for the UI. */
export function locationLabel(s: StoredLocation): string {
  if (s.name) return s.name;
  return `${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}`;
}

/** The city names `fromCity` accepts — used to populate a datalist. */
export const CITY_NAMES: string[] = [
  'Ashdod', 'Atlanta', 'Austin', 'Baghdad', 'Beer Sheva', 'Berlin', 'Baltimore',
  'Bogota', 'Boston', 'Budapest', 'Buenos Aires', 'Buffalo', 'Chicago',
  'Cincinnati', 'Cleveland', 'Dallas', 'Denver', 'Detroit', 'Eilat', 'Gibraltar',
  'Haifa', 'Hawaii', 'Helsinki', 'Houston', 'Jerusalem', 'Johannesburg', 'Kiev',
  'La Paz', 'Livingston', 'Las Vegas', 'London', 'Los Angeles', 'Marseilles',
  'Miami', 'Minneapolis', 'Melbourne', 'Mexico City', 'Montreal', 'Moscow',
  'New York', 'Omaha', 'Ottawa', 'Panama City', 'Paris', 'Pawtucket',
  'Petach Tikvah', 'Philadelphia', 'Phoenix', 'Pittsburgh', 'Providence',
  'Portland', 'Saint Louis', 'Saint Petersburg', 'San Diego', 'San Francisco',
  'Sao Paulo', 'Seattle', 'Sydney', 'Tel Aviv', 'Tiberias', 'Toronto',
  'Vancouver', 'White Plains', 'Washington DC', 'Worcester',
];
