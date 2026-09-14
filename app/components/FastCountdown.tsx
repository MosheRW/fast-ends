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
import { useTheme } from './theme';
import type { Lang, TFunc } from '@/lib/i18n';
import type { ViewState } from '@/lib/fasts';

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
  const { pref: themePref, cycle: cycleTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [loc, setLoc] = useState<StoredLocation>(DEFAULT_LOCATION);
  const [opinionId, setOpinionId] = useState<string>(DEFAULT_OPINION);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showManual, setShowManual] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [focus, setFocus] = useState(false);
  const [orientSupported, setOrientSupported] = useState(false);
  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape');

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

  // Full-screen focus mode. On mobile, orientation locking (below) only works
  // once the document is actually in fullscreen; it no-ops elsewhere (iOS/desktop).
  async function lockOrientation(type: 'landscape' | 'portrait'): Promise<boolean> {
    try {
      const o = screen.orientation as (ScreenOrientation & { lock?: (t: string) => Promise<void> }) | undefined;
      if (o && typeof o.lock === 'function') {
        await o.lock(type);
        return true;
      }
    } catch {}
    return false;
  }
  async function enterFocus() {
    setFocus(true);
    try {
      await (document.documentElement.requestFullscreen?.() ?? Promise.resolve()).catch(() => {});
    } catch {}
    // Prefer landscape on mobile; show the rotate toggle only if it actually works.
    const ok = await lockOrientation('landscape');
    setOrientSupported(ok);
    if (ok) setOrient('landscape');
  }
  function exitFocus() {
    setFocus(false);
    setOrientSupported(false);
    try {
      (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
    } catch {}
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
    } catch {}
  }
  function toggleFocus() {
    if (focus) exitFocus();
    else enterFocus();
  }
  async function toggleOrientation() {
    const next = orient === 'landscape' ? 'portrait' : 'landscape';
    if (await lockOrientation(next)) setOrient(next);
  }
  // While in focus mode, hide the rest of the page (main content + the "next
  // fasts" feed) and lock scroll, so nothing shows behind/around the overlay.
  useEffect(() => {
    if (!focus) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('focus-active');
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove('focus-active');
    };
  }, [focus]);
  // Leaving browser fullscreen (e.g. via Esc) also leaves focus mode.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFocus(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  // Esc closes focus mode even when real fullscreen was denied.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFocus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

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
  const primary = mounted ? computePrimary(view, opinionId, nowMs, t, lang) : null;

  const locBar = (
    <div className="locbar">
      <span className="pin" aria-hidden>
        <PinIcon />
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
          <PinIcon /> {geoBusy ? t('locating') : t('useMyLocation')}
        </button>
        {manualError && <p className="error small">{manualError}</p>}
      </form>
    </div>
  );

  return (
    <main className="stage">
      <div className="content">
        <div className="topbar">
          <button className="lang-toggle" onClick={toggle} aria-label="language">
            {t('langOther')}
          </button>
          <div className="topbar-right">
            <button className="icon-btn" onClick={cycleTheme} aria-label={t('themeLabel')} title={t('themeLabel')}>
              <ThemeIcon pref={themePref} />
            </button>
            <button
              className="icon-btn"
              onClick={enterFocus}
              aria-label={t('fullscreenLabel')}
              title={t('fullscreenLabel')}
              disabled={!primary}
            >
              <ExpandIcon />
            </button>
          </div>
        </div>
        <header className="head">
          <div className="logo" aria-hidden>
            <Hourglass />
          </div>
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
          <ActiveFast occ={view.occ} nowMs={nowMs} tzid={loc.tzid} opinionId={opinionId} onOpinion={chooseOpinion} onToggleFocus={toggleFocus} />
        ) : view.kind === 'pre' ? (
          <PreFast occ={view.occ} nowMs={nowMs} tzid={loc.tzid} opinionId={opinionId} onOpinion={chooseOpinion} onToggleFocus={toggleFocus} />
        ) : (
          <NoFast next={view.next} nowMs={nowMs} now={now} loc={loc} opinionId={opinionId} onOpinion={chooseOpinion} onToggleFocus={toggleFocus} />
        )}

        <footer className="foot">
          <p className="muted small">{t('disclaimer')}</p>
        </footer>
      </div>

      {focus && primary && (
        <FocusOverlay
          primary={primary}
          onClose={exitFocus}
          onToggle={toggleFocus}
          orientSupported={orientSupported}
          onRotate={toggleOrientation}
        />
      )}
    </main>
  );
}

// ---------- primary countdown + focus overlay ----------

type Primary = { title: string; label: string; ms: number; ended: boolean };

function computePrimary(view: ViewState, opinionId: string, nowMs: number, t: TFunc, lang: Lang): Primary | null {
  if (view.kind === 'active') {
    const occ = view.occ;
    const sel = occ.ends.find((e) => e.id === opinionId) ?? occ.ends[0];
    const ms = sel.time.getTime() - nowMs;
    return {
      title: fastName(occ.desc, lang),
      label: `${t('endsIn')} (${opinionText(sel.id, lang).short})`,
      ms,
      ended: ms <= 0,
    };
  }
  if (view.kind === 'pre') {
    return {
      title: fastName(view.occ.desc, lang),
      label: t('fastBeginsIn'),
      ms: view.occ.start.getTime() - nowMs,
      ended: false,
    };
  }
  if (view.kind === 'none' && view.next) {
    return {
      title: fastName(view.next.desc, lang),
      label: t('fastBeginsIn'),
      ms: view.next.start.getTime() - nowMs,
      ended: false,
    };
  }
  return null;
}

function FocusOverlay({
  primary,
  onClose,
  onToggle,
  orientSupported,
  onRotate,
}: {
  primary: Primary;
  onClose: () => void;
  onToggle: () => void;
  orientSupported: boolean;
  onRotate: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="focus" role="dialog" aria-modal="true">
      <button className="focus-exit icon-btn" onClick={onClose} aria-label={t('exit')} title={t('exit')}>
        <CloseIcon />
      </button>
      <div className="focus-inner" onDoubleClick={onToggle}>
        <h2 className="focus-title">{primary.title}</h2>
        <p className="focus-label">{primary.label}</p>
        <div className="focus-cd" role="timer" aria-live="off">
          {primary.ended ? t('fastEnded') : formatCountdown(primary.ms)}
        </div>
      </div>
      {orientSupported && (
        <button className="focus-orient" onClick={onRotate} aria-label={t('rotate')} title={t('rotate')}>
          <RotateIcon />
        </button>
      )}
    </div>
  );
}

function Hourglass() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" role="img">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1="9" y1="6.5" x2="23" y2="6.5" />
        <line x1="9" y1="25.5" x2="23" y2="25.5" />
        <path d="M10 7 C10 12 16 14 16 16 C16 18 10 20 10 25" />
        <path d="M22 7 C22 12 16 14 16 16 C16 18 22 20 22 25" />
      </g>
      <path d="M12 9 L20 9 L16 14 Z" fill="currentColor" />
      <path d="M13.6 23.4 L18.4 23.4 L16 19 Z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

// ---------- inline UI icons (stroke = currentColor) ----------

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function SunIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
function HalfMoonIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function ThemeIcon({ pref }: { pref: 'system' | 'light' | 'dark' }) {
  if (pref === 'light') return <SunIcon />;
  if (pref === 'dark') return <MoonIcon />;
  return <HalfMoonIcon />;
}
function ExpandIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg {...svgProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function RotateIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 12a8 8 0 1 1 2.3 5.6" />
      <path d="M4 20v-4h4" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg {...svgProps} width="14" height="14">
      <path d="M12 21s-6-5.7-6-10a6 6 0 1 1 12 0c0 4.3-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
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
  onToggleFocus,
}: {
  occ: FastOccurrence;
  nowMs: number;
  tzid: string;
  opinionId: string;
  onOpinion: (id: string) => void;
  onToggleFocus: () => void;
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
          <div className="countdown" role="timer" aria-live="off" onDoubleClick={onToggleFocus} title={t('fullscreenLabel')}>
            {formatCountdown(remaining)}
          </div>
          <p className="cd-sub">{t('nightfallAt', { t: formatClock(selected.time, tzid, lang) })}</p>
        </>
      ) : (
        <>
          <p className="cd-label">{t('accordingTo', { op: selShort })}</p>
          <div className="countdown done" onDoubleClick={onToggleFocus} title={t('fullscreenLabel')}>
            {t('fastEnded')}
          </div>
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
  onToggleFocus,
}: {
  occ: FastOccurrence;
  nowMs: number;
  tzid: string;
  opinionId: string;
  onOpinion: (id: string) => void;
  onToggleFocus: () => void;
}) {
  const { lang, t } = useLang();
  const remaining = occ.start.getTime() - nowMs;
  return (
    <section className="card fast-pre">
      <p className="eyebrow">{t('comingUp')}</p>
      <h2 className="fast-name">{fastName(occ.desc, lang)}</h2>
      <p className="cd-label">{t('fastBeginsIn')}</p>
      <div className="countdown begin" role="timer" aria-live="off" onDoubleClick={onToggleFocus} title={t('fullscreenLabel')}>
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
  onToggleFocus,
}: {
  next: FastOccurrence | null;
  nowMs: number;
  now: Date;
  loc: StoredLocation;
  opinionId: string;
  onOpinion: (id: string) => void;
  onToggleFocus: () => void;
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
          <div
            className="countdown small-cd"
            role="timer"
            aria-live="off"
            onDoubleClick={onToggleFocus}
            title={t('fullscreenLabel')}
          >
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
