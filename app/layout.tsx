import type { Metadata, Viewport } from 'next';
import { Anton, Caveat, Inter } from 'next/font/google';
import { publicEnv } from '@/lib/env';
import { SITE } from '@/lib/site';
import './globals.css';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Caveat is a small script accent: one static weight keeps the file small.
const caveat = Caveat({ weight: '400', subsets: ['latin'], variable: '--font-caveat', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: { default: `${SITE.name} | ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, type: 'website', locale: 'en_NG', images: [{ url: '/og/pemart', width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}` }] },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#F6F1E8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
