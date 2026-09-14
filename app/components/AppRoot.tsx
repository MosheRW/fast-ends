'use client';

import { LangProvider } from './lang';
import FastCountdown from './FastCountdown';
import ReferenceTable, { type RefFast } from './ReferenceTable';

export default function AppRoot({ fasts }: { fasts: RefFast[] }) {
  return (
    <LangProvider>
      <FastCountdown />
      <ReferenceTable fasts={fasts} />
    </LangProvider>
  );
}
