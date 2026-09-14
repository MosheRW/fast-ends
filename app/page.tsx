import FastCountdown from './components/FastCountdown';
import { getFastDates } from '@/lib/fasts';

// Server Component: everything here is rendered at build time into static HTML.
// The interactive, location-aware countdown lives in the <FastCountdown /> client
// island below. Fast *dates* are location-independent, so we can list them here.

export default function Page() {
  const now = new Date();
  const in430 = new Date(now.getTime() + 430 * 24 * 3600 * 1000);
  const upcoming = getFastDates(now, in430).slice(0, 8);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(d);

  return (
    <>
      <FastCountdown />

      <section className="reference">
        <div className="ref-inner">
          <h2 className="ref-title">Upcoming fasts</h2>
          <p className="muted small">
            Dates are the same everywhere; the exact start and end times depend on your location and
            appear in the live countdown above.
          </p>
          <ul className="ref-list">
            {upcoming.map((f) => (
              <li key={`${f.name}-${f.gregDate.toISOString().slice(0, 10)}`} className="ref-row">
                <span className={`ref-dot${f.isMajor ? ' major' : ''}`} aria-hidden />
                <span className="ref-name">{f.name}</span>
                <span className="ref-heb muted">{f.hebrewDate}</span>
                <span className="ref-greg">{fmt(f.gregDate)}</span>
                <span className="ref-tag">{f.isMajor ? '25 hr' : 'dawn–nightfall'}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
