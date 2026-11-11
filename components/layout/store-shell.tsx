import { getSettings } from '@/lib/settings';
import { AnnouncementBar } from './announcement-bar';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { WhatsAppButton } from './whatsapp-button';
import { BagDrawer } from '@/components/bag/bag-drawer';

/** Storefront chrome shared by the (store) and (account) route groups. */
export async function StoreShell({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-btn focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">Skip to content</a>
      <AnnouncementBar settings={settings} />
      <SiteHeader settings={settings} />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <SiteFooter settings={settings} />
      <WhatsAppButton number={settings.whatsapp_number} />
      <BagDrawer />
    </>
  );
}
