import type { Metadata, Viewport } from 'next';
import { Frank_Ruhl_Libre, Spectral } from 'next/font/google';
import './globals.css';

// Frank Ruhl Libre — the elegant Hebrew serif that carries the brand, headings
// and the big countdown. Spectral — a refined Latin serif for English mode.
const frankRuhl = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '500', '700', '900'],
  variable: '--font-frank',
  display: 'swap',
});
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-spectral',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'צאת הצום · End of the Fast',
  description:
    'ספירה לאחור חיה לסיום הצום (צאת הכוכבים) לפי מיקומכם, עם כל שיטות צאת הכוכבים. A live countdown to the end of the Jewish fast for your location.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3ead5' },
    { media: '(prefers-color-scheme: dark)', color: '#16130d' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${frankRuhl.variable} ${spectral.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
