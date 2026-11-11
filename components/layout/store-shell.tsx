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
        <div className="max-w-md"><p className="font-script text-3xl text-mocha">back soon</p><h1 className="display text-6xl">Pemart</h1>
          <p className="mt-3 text-lg text-muted">We&apos;re making a few updates and will be back shortly. Thank you for your patience.</p></div>
      </main>
    );
  }
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-btn focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">Skip to content</a>
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
