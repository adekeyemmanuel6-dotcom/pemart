import { JsonLd } from '@/components/json-ld';
import { SITE } from '@/lib/site';
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
  if (settings.maintenance_mode) {
    return (
      <main id="main" className="grid min-h-screen place-items-center px-6 text-center" role="main">
        <div className="max-w-md"><p className="font-script text-3xl text-mocha">back soon</p><h1 className="display text-6xl">Wear The Word</h1>
          <p className="mt-3 text-lg text-muted">We&apos;re making a few updates and will be back shortly. Thank you for your patience.</p></div>
      </main>
    );
  }
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-btn focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">Skip to content</a>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: SITE.name, url: publicEnv.NEXT_PUBLIC_SITE_URL, ...(settings.logo_url ? {logo: settings.logo_url} : {}), address: { '@type': 'PostalAddress', addressLocality: 'Akure', addressRegion: 'Ondo', addressCountry: 'NG' }, sameAs: [settings.instagram_url, settings.tiktok_url].filter(Boolean) }} />
      {process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL && <p className="bg-sand px-4 py-2 text-center text-xs">Local preview · demonstration catalogue · no live payments</p>}
      <AnnouncementBar settings={settings} />
      <SiteHeader settings={settings} />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <SiteFooter settings={settings} />
      <WhatsAppButton number={settings.whatsapp_number} />
      <BagDrawer />
      <ConsentBanner />
      <OfferPopup />
      <AnalyticsRuntime />
    </>
  );
}
