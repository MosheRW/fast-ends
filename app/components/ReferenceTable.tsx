'use client';

import { useLang } from './lang';
import { fastName } from '@/lib/fasts';
import { formatFullDate } from '@/lib/format';

export type RefFast = {
  desc: string;
  isMajor: boolean;
  gregISO: string;
  hebHe: string;
  hebEn: string;
};

export default function ReferenceTable({ fasts }: { fasts: RefFast[] }) {
  const { lang, t } = useLang();
  return (
    <section className="reference">
      <div className="ref-inner">
        <h2 className="ref-title">{t('upcomingFasts')}</h2>
        <p className="muted small">{t('upcomingSub')}</p>
        <ul className="ref-list">
          {fasts.map((f) => (
            <li key={`${f.desc}-${f.gregISO.slice(0, 10)}`} className="ref-row">
              <span className={`ref-dot${f.isMajor ? ' major' : ''}`} aria-hidden />
              <span className="ref-name">{fastName(f.desc, lang)}</span>
              <span className="ref-heb muted">{lang === 'he' ? f.hebHe : f.hebEn}</span>
              <span className="ref-greg">{formatFullDate(new Date(f.gregISO), lang)}</span>
              <span className="ref-tag">{f.isMajor ? t('tagMajor') : t('tagMinor')}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
