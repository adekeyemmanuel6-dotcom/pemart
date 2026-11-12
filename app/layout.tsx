import { getSettings } from '@/lib/settings';
import { resolveWebsite } from '@/lib/website/schema';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { publicEnv } from '@/lib/env';
import { SITE } from '@/lib/site';
import './globals.css';

const anton = localFont({
  src: '../assets/fonts/Anton-Regular.ttf',
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = resolveWebsite(await getSettings());
  const base: Metadata = {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: `${SITE.name} | ${SITE.tagline}`, template: `%s | ${SITE.name}` },
    description: SITE.description,
    openGraph: {
      siteName: SITE.name,
      type: 'website',
      locale: 'en_NG',
      images: [{ url: '/og/pemart', width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}` }],
    },
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined },
    twitter: { card: 'summary_large_image' },
  };
  return {
    ...base,
    title: { default: brand.seoTitle, template: '%s | ' + brand.name },
    description: brand.seoDescription,
    openGraph: {
      ...base.openGraph,
      siteName: brand.name,
      ...(brand.ogImage ? { images: [{ url: brand.ogImage }] } : {}),
    },
  };
}

export const viewport: Viewport = { themeColor: '#F4F0E8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={anton.variable}>
      <body>{children}</body>
    </html>
  );
}
