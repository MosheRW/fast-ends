'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_LANG, dirFor, makeT, type Lang, type TFunc } from '@/lib/i18n';

const LS_LANG = 'eotf.lang';

type Ctx = {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: TFunc;
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Restore saved language after mount (kept out of the initial render to avoid
  // a hydration mismatch — server and first client render both use DEFAULT_LANG).
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_LANG);
      if (s === 'he' || s === 'en') setLangState(s);
    } catch {}
  }, []);

  // Reflect language on the document for correct direction & lang attribute.
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
      document.documentElement.dir = dirFor(lang);
    } catch {}
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LS_LANG, l);
    } catch {}
  }, []);

  const toggle = useCallback(() => setLang(lang === 'he' ? 'en' : 'he'), [lang, setLang]);

  const value: Ctx = { lang, dir: dirFor(lang), t: makeT(lang), setLang, toggle };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within <LangProvider>');
  return ctx;
}
