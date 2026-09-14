import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'End of the Fast — live countdown',
  description:
    'A live countdown to the end of the Jewish fast (nightfall) for your location, with all major tzeit opinions. On other days: the next fast and today’s Hebrew date.',
};

export const viewport: Viewport = {
  themeColor: '#0b1026',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
