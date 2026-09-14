'use client';

import { LangProvider } from './lang';
import { ThemeProvider } from './theme';
import FastCountdown from './FastCountdown';
import ReferenceTable, { type RefFast } from './ReferenceTable';

export default function AppRoot({ fasts }: { fasts: RefFast[] }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <FastCountdown />
        <ReferenceTable fasts={fasts} />
      </LangProvider>
    </ThemeProvider>
  );
}
