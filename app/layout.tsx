import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'צאת הצום · End of the Fast',
  description:
    'ספירה לאחור חיה לסיום הצום (צאת הכוכבים) לפי מיקומכם, עם כל שיטות צאת הכוכבים. A live countdown to the end of the Jewish fast for your location.',
};

export const viewport: Viewport = {
  themeColor: '#0b1026',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
