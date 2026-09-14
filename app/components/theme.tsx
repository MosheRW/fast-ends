'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const LS_THEME = 'eotf.theme';

export type ThemePref = 'system' | 'light' | 'dark';
export type Resolved = 'light' | 'dark';

type Ctx = {
  pref: ThemePref;
  resolved: Resolved;
  setPref: (p: ThemePref) => void;
  cycle: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

const ORDER: ThemePref[] = ['system', 'light', 'dark'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [systemDark, setSystemDark] = useState(true);

  // Restore saved preference + current system setting after mount.
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_THEME);
      if (s === 'system' || s === 'light' || s === 'dark') setPrefState(s);
    } catch {}
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemDark(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {}
  }, []);

  const resolved: Resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

  // Stamp the resolved theme on <html> for CSS.
  useEffect(() => {
    try {
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    } catch {}
  }, [resolved]);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(LS_THEME, p);
    } catch {}
  };

  const cycle = () => setPref(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]);

  return <ThemeContext.Provider value={{ pref, resolved, setPref, cycle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
