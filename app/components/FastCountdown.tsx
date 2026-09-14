'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  StoredLocation,
  fromCoords,
  fromCity,
  toLocation,
  locationLabel,
  CITY_NAMES,
} from '@/lib/location';
import {
  OPINIONS,
  DEFAULT_OPINION,
  getFastOccurrences,
  pickState,
  hebrewDateString,
  sunTimes,
  OCCURRENCE_WINDOW,
  type FastOccurrence,
  type FastEnd,
} from '@/lib/fasts';
import { formatClock, formatDay, formatCountdown, formatUntil } from '@/lib/format';

const LS_LOC = 'eotf.location';
const LS_OP = 'eotf.opinion';

type GeoStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unsupported';

type Overrides = { date?: Date; loc?: StoredLocation };

/** Dev/test overrides via query params: ?date=YYYY-MM-DDTHH:MM&lat=..&lon=..&city=.. */
function readOverrides(): Overrides {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const out: Overrides = {};
  const date = q.get('date');
  if (date) {
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) out.date = d;
  }
  const lat = parseFloat(q.get('lat') ?? '');
  const lon = parseFloat(q.get('lon') ?? '');
  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    out.loc = fromCoords(lat, lon, 'manual', q.get('city') ?? 'Test location');
  }
  return out;
}

export default function FastCountdown() {
  const [mounted, setMounted] = useState(false);
  const [loc, setLoc] = useState<StoredLocation | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [opinionId, setOpinionId] = useState<string>(DEFAULT_OPINION);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState('');

  const offsetRef = useRef(0); // dev date offset (ms)
  const anchorRef = useRef(Date.now()); // stable anchor for occurrence window

  // Mount: restore prefs, apply overrides, start locating.
  useEffect(() => {
    setMounted(true);
    const ov = readOverrides();
    try {
      const o = localStorage.getItem(LS_OP);
      if (o) setOpinionId(o);
    } catch {}
    if (ov.date) {
      offsetRef.current = ov.date.getTime() - Date.now();
      anchorRef.current = ov.date.getTime();
      setNowMs(ov.date.getTime());
    }
    if (ov.loc) {
      setLoc(ov.loc);
      setStatus('ready');
      return;
    }
    let saved: StoredLocation | null = null;
    try {
      const s = localStorage.getItem(LS_LOC);
      if (s) saved = JSON.parse(s) as StoredLocation;
    } catch {}
    if (saved && typeof saved.lat === 'number') {
      setLoc(saved);
      setStatus('ready');
      return;
    }
    requestGeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick every second.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now() + offsetRef.current), 1000);
    return () => clearInterval(id);
  }, []);

  function requestGeo() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      setShowManual(true);
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const s = fromCoords(pos.coords.latitude, pos.coords.longitude, 'geo');
        persistLoc(s);
        setLoc(s);
        setStatus('ready');
        setShowManual(false);
      },
      () => {
        setStatus('denied');
        setShowManual(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  function persistLoc(s: StoredLocation) {
    try {
      localStorage.setItem(LS_LOC, JSON.stringify(s));
    } catch {}
  }

  function chooseOpinion(id: string) {
    setOpinionId(id);
    try {
      localStorage.setItem(LS_OP, id);
    } catch {}
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const raw = manualInput.trim();
    if (!raw) return;
    const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    let s: StoredLocation | null;
    if (m) {
      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      s = lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? fromCoords(lat, lon, 'manual') : null;
    } else {
      s = fromCity(raw);
    }
    if (!s) {
      setManualError('Not found. Try a listed city, or enter "latitude, longitude".');
      return;
    }
    setManualError('');
    setManualInput('');
    persistLoc(s);
    setLoc(s);
    setStatus('ready');
    setShowManual(false);
  }

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const hebLoc = useMemo(() => (loc ? toLocation(loc) : null), [loc]);

  // Expensive: compute occurrences once per location (stable anchor).
  const occs = useMemo<FastOccurrence[]>(() => {
    if (!hebLoc) return [];
    const a = anchorRef.current;
    return getFastOccurrences(hebLoc, new Date(a - OCCURRENCE_WINDOW.back), new Date(a + OCCURRENCE_WINDOW.forward));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hebLoc]);

  const view = useMemo(() => (occs.length || hebLoc ? pickState(occs, now) : null), [occs, hebLoc, now]);

  // ---------- render ----------

  if (!mounted) {
    return (
      <main className="stage">
        <div className="card center">
          <p className="muted">Loading…</p>
        </div>
      </main>
    );
  }

  const locBar = loc ? (
    <div className="locbar">
      <span className="pin" aria-hidden>
        📍
      </span>
      <span>{locationLabel(loc)}</span>
      <button className="link" onClick={() => setShowManual((v) => !v)}>
        change
      </button>
    </div>
  ) : null;

  const manualForm = (
    <form className="manual" onSubmit={submitManual}>
      <label htmlFor="loc-input" className="muted small">
        Enter a city or “latitude, longitude”
      </label>
      <div className="manual-row">
        <input
          id="loc-input"
          list="cities"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="e.g. Jerusalem  ·  40.71, -74.01"
          autoComplete="off"
        />
        <button type="submit" className="btn">
          Set
        </button>
      </div>
      <datalist id="cities">
        {CITY_NAMES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {status !== 'ready' && (
        <button type="button" className="link" onClick={requestGeo}>
          Use my device location
        </button>
      )}
      {manualError && <p className="error small">{manualError}</p>}
    </form>
  );

  return (
    <main className="stage">
      <div className="stars" aria-hidden />
      <div className="content">
        <header className="head">
          <h1 className="brand">End of the Fast</h1>
          <p className="hebdate" aria-live="polite">
            {hebrewDateString(now)}
          </p>
          {locBar}
        </header>

        {showManual && <div className="card">{manualForm}</div>}

        {status === 'locating' && !loc && (
          <div className="card center">
            <p className="big-msg">Finding your location…</p>
            <p className="muted small">Allow location access for times based on where you are.</p>
            <button className="link" onClick={() => setShowManual(true)}>
              Or enter it manually
            </button>
          </div>
        )}

        {(status === 'denied' || status === 'unsupported') && !loc && !showManual && (
          <div className="card center">
            <p className="big-msg">Location unavailable</p>
            <button className="btn" onClick={() => setShowManual(true)}>
              Enter a location
            </button>
          </div>
        )}

        {loc && view && view.kind === 'active' && (
          <ActiveFast occ={view.occ} nowMs={nowMs} tzid={loc.tzid} opinionId={opinionId} onOpinion={chooseOpinion} />
        )}
        {loc && view && view.kind === 'pre' && (
          <PreFast occ={view.occ} nowMs={nowMs} tzid={loc.tzid} opinionId={opinionId} onOpinion={chooseOpinion} />
        )}
        {loc && view && view.kind === 'none' && (
          <NoFast next={view.next} nowMs={nowMs} now={now} loc={loc} opinionId={opinionId} onOpinion={chooseOpinion} />
        )}

        <footer className="foot">
          <p className="muted small">
            Times are computed for guidance only — confirm with your local halachic authority.
            Nightfall opinions shown: three stars (8.5°), three medium stars (7.083°), 42 minutes,
            and Rabbeinu Tam (72 minutes). Daylight-saving and elevation can shift times by a few minutes.
          </p>
        </footer>
      </div>
    </main>
  );
}

// ---------- opinion selector ----------

function OpinionGrid({
  ends,
  nowMs,
  tzid,
  opinionId,
  onOpinion,
}: {
  ends: FastEnd[];
  nowMs: number;
  tzid: string;
  opinionId: string;
  onOpinion: (id: string) => void;
}) {
  return (
    <div className="opinions" role="radiogroup" aria-label="Nightfall opinion">
      {ends.map((e) => {
        const remaining = e.time.getTime() - nowMs;
        const selected = e.id === opinionId;
        const past = remaining <= 0;
        return (
          <button
            key={e.id}
            role="radio"
            aria-checked={selected}
            className={`opinion${selected ? ' selected' : ''}${past ? ' past' : ''}`}
            onClick={() => onOpinion(e.id)}
            title={e.note}
          >
            <span className="op-label">{e.label}</span>
            <span className="op-time">{formatClock(e.time, tzid)}</span>
            <span className="op-status">{past ? 'ended' : formatCountdown(remaining)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- active fast ----------

function ActiveFast({
  occ,
  nowMs,
  tzid,
  opinionId,
  onOpinion,
}: {
  occ: FastOccurrence;
  nowMs: number;
  tzid: string;
  opinionId: string;
  onOpinion: (id: string) => void;
}) {
  const selected = occ.ends.find((e) => e.id === opinionId) ?? occ.ends[0];
  const remaining = selected.time.getTime() - nowMs;
  const nextUnpassed = occ.ends.find((e) => e.time.getTime() > nowMs);

  return (
    <section className="card fast-active">
      <p className="eyebrow">Fast in progress</p>
      <h2 className="fast-name">{occ.name}</h2>

      {remaining > 0 ? (
        <>
          <p className="cd-label">Ends in ({selected.short})</p>
          <div className="countdown" role="timer" aria-live="off">
            {formatCountdown(remaining)}
          </div>
          <p className="cd-sub">Nightfall at {formatClock(selected.time, tzid)}</p>
        </>
      ) : (
        <>
          <p className="cd-label">According to {selected.short}</p>
          <div className="countdown done">The fast has ended 🌙</div>
          {nextUnpassed && (
            <p className="cd-sub">
              A later opinion ({nextUnpassed.short}) ends in {formatCountdown(nextUnpassed.time.getTime() - nowMs)}.
            </p>
          )}
        </>
      )}

      <OpinionGrid ends={occ.ends} nowMs={nowMs} tzid={tzid} opinionId={opinionId} onOpinion={onOpinion} />
      <p className="muted small start-note">Fast began {formatDay(occ.start, tzid)} at {formatClock(occ.start, tzid)}.</p>
    </section>
  );
}

// ---------- pre-fast (begins soon) ----------

function PreFast({
  occ,
  nowMs,
  tzid,
  opinionId,
  onOpinion,
}: {
  occ: FastOccurrence;
  nowMs: number;
  tzid: string;
  opinionId: string;
  onOpinion: (id: string) => void;
}) {
  const remaining = occ.start.getTime() - nowMs;
  return (
    <section className="card fast-pre">
      <p className="eyebrow">Coming up</p>
      <h2 className="fast-name">{occ.name}</h2>
      <p className="cd-label">Fast begins in</p>
      <div className="countdown begin" role="timer" aria-live="off">
        {formatCountdown(remaining)}
      </div>
      <p className="cd-sub">Begins {formatDay(occ.start, tzid)} at {formatClock(occ.start, tzid)}</p>
      <p className="muted small">Nightfall (end of fast) times:</p>
      <OpinionGrid ends={occ.ends} nowMs={nowMs} tzid={tzid} opinionId={opinionId} onOpinion={onOpinion} />
    </section>
  );
}

// ---------- no fast today ----------

function NoFast({
  next,
  nowMs,
  now,
  loc,
  opinionId,
  onOpinion,
}: {
  next: FastOccurrence | null;
  nowMs: number;
  now: Date;
  loc: StoredLocation;
  opinionId: string;
  onOpinion: (id: string) => void;
}) {
  const sun = useMemo(() => sunTimes(toLocation(loc), now, opinionId), [loc, nowMs, opinionId]);
  return (
    <section className="card fast-none">
      <p className="eyebrow">Today</p>
      <h2 className="fast-name calm">No fast today</h2>
      <p className="cd-sub">{formatDay(now, loc.tzid)}</p>

      <div className="suntimes">
        <div className="sun-cell">
          <span className="op-label">Sunset</span>
          <span className="op-time">{formatClock(sun.sunset, loc.tzid)}</span>
        </div>
        <div className="sun-cell">
          <span className="op-label">Nightfall</span>
          <span className="op-time">{formatClock(sun.nightfall, loc.tzid)}</span>
        </div>
      </div>

      <div className="opinion-picker">
        <span className="muted small">Nightfall opinion:</span>
        <div className="chips">
          {OPINIONS.map((o) => (
            <button
              key={o.id}
              className={`chip${o.id === opinionId ? ' selected' : ''}`}
              onClick={() => onOpinion(o.id)}
              title={o.note}
            >
              {o.short}
            </button>
          ))}
        </div>
      </div>

      {next && (
        <div className="next-fast">
          <p className="eyebrow">Next fast</p>
          <h3 className="next-name">{next.name}</h3>
          <p className="cd-sub">
            {next.hebrewDate} · {formatDay(next.start, loc.tzid)} · {formatUntil(next.start.getTime() - nowMs)}
          </p>
          <div className="countdown small-cd" role="timer" aria-live="off">
            {formatCountdown(next.start.getTime() - nowMs)}
          </div>
          <p className="muted small">
            Begins at {formatClock(next.start, loc.tzid)} · ends around{' '}
            {formatClock((next.ends.find((e) => e.id === opinionId) ?? next.ends[0]).time, loc.tzid)}
          </p>
        </div>
      )}
    </section>
  );
}
