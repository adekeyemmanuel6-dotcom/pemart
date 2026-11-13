import type { CSSProperties } from 'react';
import { JsonLd } from '@/components/json-ld';
import { resolveWebsite } from '@/lib/website/schema';
import { publicEnv } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { AnnouncementBar } from './announcement-bar';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { WhatsAppButton } from './whatsapp-button';
import { ConsentBanner } from '@/components/consent/consent-banner';
import { AnalyticsRuntime } from '@/components/consent/analytics-runtime';
import { OfferPopup } from '@/components/offer/offer-popup';
import { BagDrawer } from '@/components/bag/bag-drawer';

/** Storefront chrome shared by the (store) and (account) route groups. */
export async function StoreShell({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const content = resolveWebsite(settings);
  if (settings.maintenance_mode) {
    return (
      <main id="main" className="grid min-h-screen place-items-center px-6 text-center" role="main">
        <div className="max-w-md">
          <p className="font-script text-3xl text-mocha">back soon</p>
          <h1 className="display text-6xl">{content.brand.name}</h1>
          <p className="mt-3 text-lg text-muted">{content.brand.maintenanceMessage}</p>
        </div>
      </main>
    );
  }
  const colours =
    content.brand.palette === 'forest'
      ? { '--ink': '#132b21', '--paper': '#fafbf8', '--sand': '#e6ece4', '--muted': '#4f6658', '--line': '#cbd6c8' }
      : content.brand.palette === 'earth'
        ? { '--ink': '#30251c', '--paper': '#fffdf8', '--sand': '#f0e6d7', '--muted': '#6b5b4b', '--line': '#ded1bf' }
        : {};
  const heading =
    content.brand.headingStyle === 'serif'
      ? 'Georgia, serif'
      : content.brand.headingStyle === 'sans'
        ? 'Arial, sans-serif'
        : undefined;
  return (
    <div
      className="min-h-screen bg-paper text-ink"
      style={{ ...colours, ...(heading ? { '--font-display': heading } : {}) } as CSSProperties}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-btn focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
      >
        Skip to content
      </a>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: content.brand.name,
          url: publicEnv.NEXT_PUBLIC_SITE_URL,
          logo: new URL(content.brand.logoOnLight || '/brand/wear-the-word-logo-black.png', publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
          address: { '@type': 'PostalAddress', addressLocality: 'Akure', addressRegion: 'Ondo', addressCountry: 'NG' },
          sameAs: [settings.instagram_url, settings.tiktok_url].filter(Boolean),
        }}
      />
      {process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL && (
        <p className="bg-sand px-4 py-2 text-center text-xs">
          Local preview · demonstration catalogue · no live payments
        </p>
      )}
      <AnnouncementBar settings={settings} />
      <SiteHeader settings={settings} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter settings={settings} />
      <WhatsAppButton number={settings.whatsapp_number} />
      <BagDrawer />
      <ConsentBanner />
      <OfferPopup />
      <AnalyticsRuntime />
    </div>
  );
}
