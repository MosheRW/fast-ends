'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  StoredLocation,
  DEFAULT_LOCATION,
  fromCoords,
  resolveCity,
  toLocation,
  locationLabel,
  cityOptions,
} from '@/lib/location';
import {
  DEFAULT_OPINION,
  getFastOccurrences,
  pickState,
  hebrewDateString,
  sunTimes,
  fastName,
  opinionText,
  OPINIONS,
  OCCURRENCE_WINDOW,
  type FastOccurrence,
  type FastEnd,
} from '@/lib/fasts';
import { formatClock, formatDay, formatCountdown, formatUntil } from '@/lib/format';
import { useLang } from './lang';

const LS_LOC = 'eotf.location';
const LS_OP = 'eotf.opinion';

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
    const name = q.get('city') ?? undefined;
    out.loc = { ...fromCoords(lat, lon, 'manual', name), nameHe: name };
  }
  return out;
}

export default function FastCountdown() {
  const { lang, t, toggle } = useLang();

  const [mounted, setMounted] = useState(false);
  const [loc, setLoc] = useState<StoredLocation>(DEFAULT_LOCATION);
  const [opinionId, setOpinionId] = useState<string>(DEFAULT_OPINION);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);

  const offsetRef = useRef(0); // dev date offset (ms)
  const anchorRef = useRef(Date.now()); // stable anchor for the occurrence window

  // Mount: restore prefs, apply overrides; otherwise keep the Jerusalem default
  // so a newcomer immediately sees a live countdown.
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
      return;
    }
    try {
      const s = localStorage.getItem(LS_LOC);
      if (s) {
        const saved = JSON.parse(s) as StoredLocation;
        if (typeof saved.lat === 'number') setLoc(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick every second.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now() + offsetRef.current), 1000);
    return () => clearInterval(id);
  }, []);

  function persistLoc(s: StoredLocation) {
    try {
      localStorage.setItem(LS_LOC, JSON.stringify(s));
    } catch {}
  }

  function requestGeo() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setManualError(t('locUnavailable'));
      return;
    }
    setGeoBusy(true);
    setManualError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const s = fromCoords(pos.coords.latitude, pos.coords.longitude, 'geo');
        persistLoc(s);
        setLoc(s);
        setGeoBusy(false);
        setShowManual(false);
      },
      () => {
        setGeoBusy(false);
        setManualError(t('locUnavailable'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
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
      s = resolveCity(raw);
    }
    if (!s) {
      setManualError(t('notFound'));
      return;
    }
    setManualError('');
    setManualInput('');
    persistLoc(s);
    setLoc(s);
    setShowManual(false);
  }

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const hebLoc = useMemo(() => toLocation(loc), [loc]);

  // Expensive: compute occurrences once per location (stable anchor).
  const occs = useMemo<FastOccurrence[]>(() => {
    const a = anchorRef.current;
    return getFastOccurrences(hebLoc, new Date(a - OCCURRENCE_WINDOW.back), new Date(a + OCCURRENCE_WINDOW.forward));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hebLoc]);

  const view = useMemo(() => pickState(occs, now), [occs, now]);

  const locBar = (
    <div className="locbar">
      <span className="pin" aria-hidden>
        📍
      </span>
      <span>{locationLabel(loc, lang)}</span>
      <button className="link" onClick={() => setShowManual((v) => !v)}>
        {t('change')}
      </button>
    </div>
  );

  const panel = (
    <div className="card">
      <form className="manual" onSubmit={submitManual}>
        <label htmlFor="loc-input" className="muted small">
          {t('enterCityLabel')}
        </label>
        <div className="manual-row">
          <input
            id="loc-input"
            list="cities"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={t('placeholder')}
            autoComplete="off"
          />
          <button type="submit" className="btn">
            {t('setBtn')}
          </button>
        </div>
        <datalist id="cities">
          {cityOptions(lang).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button type="button" className="link loc-link" onClick={requestGeo} disabled={geoBusy}>
          📍 {geoBusy ? t('locating') : t('useMyLocation')}
        </button>
        {manualError && <p className="error small">{manualError}</p>}
      </form>
    </div>
  );

  return (
    <main className="stage">
      <div className="stars" aria-hidden />
      <div className="content">
        <button className="lang-toggle" onClick={toggle} aria-label="language">
          {t('langOther')}
        </button>
        <header className="head">
          <h1 className="brand">{t('brand')}</h1>
          {mounted && (
            <p className="hebdate" aria-live="polite">
              {hebrewDateString(now, lang)}
            </p>
          )}
          {locBar}
        </header>

        {showManual && panel}

        {!mounted ? (
          <div className="card center">
            <p className="muted">{t('loading')}</p>
          </div>
        ) : view.kind === 'active' ? (
          <ActiveFast occ={view.occ} nowMs={nowMs} tzid={loc.tzid} opinionId={opinionId} onOpinion={chooseOpinion} />
        ) : view.kind === 'pre' ? (
          <PreFast occ={view.occ} nowMs={nowMs} tzid={loc.tzid} opinionId={opinionId} onOpinion={chooseOpinion} />
        ) : (
          <NoFast next={view.next} nowMs={nowMs} now={now} loc={loc} opinionId={opinionId} onOpinion={chooseOpinion} />
        )}

        <footer className="foot">
          <p className="muted small">{t('disclaimer')}</p>
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
  const { lang } = useLang();
  return (
    <div className="opinions" role="radiogroup" aria-label="tzeit">
      {ends.map((e) => {
        const remaining = e.time.getTime() - nowMs;
        const selected = e.id === opinionId;
        const past = remaining <= 0;
        const txt = opinionText(e.id, lang);
        return (
          <button
            key={e.id}
            role="radio"
            aria-checked={selected}
            className={`opinion${selected ? ' selected' : ''}${past ? ' past' : ''}`}
            onClick={() => onOpinion(e.id)}
            title={txt.note}
          >
            <span className="op-label">{txt.label}</span>
            <span className="op-time">{formatClock(e.time, tzid, lang)}</span>
            <span className="op-status">{past ? '—' : formatCountdown(remaining)}</span>
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
  const { lang, t } = useLang();
  const selected = occ.ends.find((e) => e.id === opinionId) ?? occ.ends[0];
  const remaining = selected.time.getTime() - nowMs;
  const nextUnpassed = occ.ends.find((e) => e.time.getTime() > nowMs);
  const selShort = opinionText(selected.id, lang).short;

  return (
    <section className="card fast-active">
      <p className="eyebrow">{t('fastInProgress')}</p>
      <h2 className="fast-name">{fastName(occ.desc, lang)}</h2>

      {remaining > 0 ? (
        <>
          <p className="cd-label">
            {t('endsIn')} ({selShort})
          </p>
          <div className="countdown" role="timer" aria-live="off">
            {formatCountdown(remaining)}
          </div>
          <p className="cd-sub">{t('nightfallAt', { t: formatClock(selected.time, tzid, lang) })}</p>
        </>
      ) : (
        <>
          <p className="cd-label">{t('accordingTo', { op: selShort })}</p>
          <div className="countdown done">{t('fastEnded')}</div>
          {nextUnpassed && (
            <p className="cd-sub">
              {t('laterOpinion', {
                op: opinionText(nextUnpassed.id, lang).short,
                cd: formatCountdown(nextUnpassed.time.getTime() - nowMs),
              })}
            </p>
          )}
        </>
      )}

      <OpinionGrid ends={occ.ends} nowMs={nowMs} tzid={tzid} opinionId={opinionId} onOpinion={onOpinion} />
      <p className="muted small start-note">
        {t('fastBegan', { day: formatDay(occ.start, tzid, lang), t: formatClock(occ.start, tzid, lang) })}
      </p>
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
  const { lang, t } = useLang();
  const remaining = occ.start.getTime() - nowMs;
  return (
    <section className="card fast-pre">
      <p className="eyebrow">{t('comingUp')}</p>
      <h2 className="fast-name">{fastName(occ.desc, lang)}</h2>
      <p className="cd-label">{t('fastBeginsIn')}</p>
      <div className="countdown begin" role="timer" aria-live="off">
        {formatCountdown(remaining)}
      </div>
      <p className="cd-sub">
        {t('beginsAt', { day: formatDay(occ.start, tzid, lang), t: formatClock(occ.start, tzid, lang) })}
      </p>
      <p className="muted small">{t('nightfallTimes')}</p>
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
  const { lang, t } = useLang();
  const sun = useMemo(() => sunTimes(toLocation(loc), now, opinionId), [loc, nowMs, opinionId]);
  return (
    <section className="card fast-none">
      <p className="eyebrow">{t('today')}</p>
      <h2 className="fast-name calm">{t('noFastToday')}</h2>
      <p className="cd-sub">{formatDay(now, loc.tzid, lang)}</p>

      <div className="suntimes">
        <div className="sun-cell">
          <span className="op-label">{t('sunset')}</span>
          <span className="op-time">{formatClock(sun.sunset, loc.tzid, lang)}</span>
        </div>
        <div className="sun-cell">
          <span className="op-label">{t('nightfall')}</span>
          <span className="op-time">{formatClock(sun.nightfall, loc.tzid, lang)}</span>
        </div>
      </div>

      <div className="opinion-picker">
        <span className="muted small">{t('nightfallOpinion')}</span>
        <div className="chips">
          {OPINIONS.map((o) => (
            <button
              key={o.id}
              className={`chip${o.id === opinionId ? ' selected' : ''}`}
              onClick={() => onOpinion(o.id)}
              title={o.note[lang]}
            >
              {o.short[lang]}
            </button>
          ))}
        </div>
      </div>

      {next && (
        <div className="next-fast">
          <p className="eyebrow">{t('nextFast')}</p>
          <h3 className="next-name">{fastName(next.desc, lang)}</h3>
          <p className="cd-sub">
            {(lang === 'he' ? next.hebrew.he : next.hebrew.en)} · {formatDay(next.start, loc.tzid, lang)} ·{' '}
            {formatUntil(next.start.getTime() - nowMs, lang)}
          </p>
          <div className="countdown small-cd" role="timer" aria-live="off">
            {formatCountdown(next.start.getTime() - nowMs)}
          </div>
          <p className="muted small">
            {t('beginsEndsAround', {
              a: formatClock(next.start, loc.tzid, lang),
              b: formatClock((next.ends.find((e) => e.id === opinionId) ?? next.ends[0]).time, loc.tzid, lang),
            })}
          </p>
        </div>
      )}
    </section>
  );
}
