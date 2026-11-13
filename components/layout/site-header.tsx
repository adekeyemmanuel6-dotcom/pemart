import Link from 'next/link';
import { Search, User } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';
import { resolveWebsite } from '@/lib/website/schema';
import { getCatalogue } from '@/lib/catalogue/load';
import { buildNavigation, forDevice } from '@/lib/navigation';
import type { Catalogue } from '@/lib/catalogue/types';
import { Logo } from './logo';
import { MegaMenu } from './mega-menu';
import { MobileNav } from './mobile-nav';
import { BagButton } from './bag-button';

const iconBtn = 'grid size-11 place-items-center transition-colors duration-150 hover:bg-sand';

/**
 * Three levels: the announcement bar (rendered above, scrolls away), this sticky header with the
 * navigation left, the logo centred and utilities right, and the full-width mega-menu panels below it.
 */
export async function SiteHeader({ settings }: { settings: StoreSettings }) {
  const content = resolveWebsite(settings);
  // The header must not take the whole page down if the catalogue is briefly unavailable;
  // the menu then simply omits catalogue-dependent links.
  let cat: Catalogue | null = null;
  try { cat = await getCatalogue(); } catch { cat = null; }
  const hero = content.sections.find((s) => s.id === 'hero');
  const panels = buildNavigation(content, cat, { image: hero?.image || null, alt: hero?.alt || null });

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8 xl:px-16">
        <div className="flex items-center">
          <MobileNav panels={forDevice(panels, 'mobile')} />
          <nav className="hidden lg:block" aria-label="Main">
            <MegaMenu panels={forDevice(panels, 'desktop')} />
          </nav>
        </div>
        <div className="justify-self-center">
          <Logo logoUrl={settings.logo_url} name={content.brand.name} byline={content.brand.byline} />
        </div>
        <div className="flex items-center justify-self-end">
          <Link href="/search" className={iconBtn} aria-label="Search">
            <Search className="size-5" aria-hidden />
          </Link>
          <Link href="/account" className={`${iconBtn} hidden sm:grid`} aria-label="Account and wishlist">
            <User className="size-5" aria-hidden />
          </Link>
          <BagButton />
        </div>
      </div>
    </header>
  );
}
