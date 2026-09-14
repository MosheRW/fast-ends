# End of the Fast

A single-page site that uses your device's location to show a **live countdown to the end of the
current Jewish fast** (nightfall / tzeit hakochavim). On non-fast days it shows today's Hebrew date,
today's sunset & nightfall, and the next upcoming fast with a countdown.

Built with **Next.js (App Router)** and **statically exported** — `npm run build` produces a folder
of static files with no server needed at runtime. Fast dates and times are computed entirely in the
browser with [`@hebcal/core`](https://github.com/hebcal/hebcal-es6); **your coordinates never leave
your device** (no backend, no third-party geocoding).

## Fasts tracked (7)

Yom Kippur and Tisha B'Av (major, ~25 hours, begin at sunset the previous evening) and Tzom
Gedaliah, Asara B'Tevet, Ta'anit Esther, Seventeenth of Tammuz, and Ta'anit Bechorot (the Fast of
the Firstborn) — minor fasts from dawn to nightfall. Postponed fasts (when a fast would fall on
Shabbat) resolve to their correct observed date automatically.

## End-of-fast (nightfall) opinions shown

All four side by side, with one driving the big countdown (tap to switch; your choice is remembered):

- **3 stars — 8.5°** (default)
- **3 medium stars — 7.083°**
- **42 minutes** after sunset
- **Rabbeinu Tam — 72 minutes** after sunset

Times are computed for guidance only — confirm with your local halachic authority. DST and elevation
can shift times by a few minutes.

## Location

Uses the browser Geolocation API. If you deny or it's unavailable, enter a location manually — either
one of hebcal's built-in city names (offline lookup) or raw `latitude, longitude`.

> Geolocation requires a **secure context**: it works on `https://` and on `http://localhost`.

## Develop & build

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # outputs a static site to ./out
npx serve out      # preview the static export (no Node server)
```

### Dev/test overrides

Simulate any date/place without waiting for a real fast, via query params:

```
/?date=2025-10-01T18:00&lat=31.77&lon=35.21     # Yom Kippur eve in Jerusalem
/?date=2025-09-24T10:00&city=New%20York&lat=40.71&lon=-74.01
```

`date` sets a starting clock (it still ticks); `lat`/`lon` (and optional `city`) set the location.

## Structure

- `app/page.tsx` — Server Component: static shell + build-time "upcoming fasts" table.
- `app/components/FastCountdown.tsx` — the only Client Component: geolocation, zmanim, state machine,
  per-second countdown.
- `lib/fasts.ts` — pure fast logic (occurrences, tzeit opinions, state selection), shared by both.
- `lib/location.ts`, `lib/format.ts` — location + time-formatting helpers.

## Deploying under a sub-path

For GitHub Pages project sites, set `basePath` in `next.config.mjs` to your repo name.
