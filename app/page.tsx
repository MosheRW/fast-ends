import AppRoot from './components/AppRoot';
import { getFastDates } from '@/lib/fasts';
import type { RefFast } from './components/ReferenceTable';

// Server Component: fast *dates* are location-independent, so we compute them at
// build time and hand them to the client app, which localizes and formats them.

export default function Page() {
  const now = new Date();
  const in430 = new Date(now.getTime() + 430 * 24 * 3600 * 1000);
  const fasts: RefFast[] = getFastDates(now, in430)
    .slice(0, 8)
    .map((f) => ({
      desc: f.desc,
      isMajor: f.isMajor,
      gregISO: f.gregDate.toISOString(),
      hebHe: f.hebrew.he,
      hebEn: f.hebrew.en,
    }));

  return <AppRoot fasts={fasts} />;
}
