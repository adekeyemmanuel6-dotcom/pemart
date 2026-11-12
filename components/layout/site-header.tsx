import Link from 'next/link';
import { Search, User } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';
import { resolveWebsite } from '@/lib/website/schema';
import { Logo } from './logo';
import { MegaMenu } from './mega-menu';
import { MobileNav } from './mobile-nav';
import { BagButton } from './bag-button';

export function SiteHeader({ settings }: { settings: StoreSettings }) {
  const content = resolveWebsite(settings);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <MobileNav navigation={content.navigation} />
        <div className="mr-2 flex-1 lg:flex-none">
          <Logo logoUrl={settings.logo_url} name={content.brand.name} byline={content.brand.byline} />
        </div>
        <nav className="hidden flex-1 items-center lg:flex" aria-label="Main">
          <MegaMenu links={content.navigation.shop} />
          {content.navigation.main.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`inline-flex min-h-12 items-center px-2 text-xs font-semibold hover:text-denim `}
            >
              {n.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center">
          <Link
            href="/search"
            className="grid size-12 place-items-center rounded-btn hover:bg-sand"
            aria-label="Search"
          >
            <Search className="size-6" aria-hidden />
          </Link>
          <Link
            href="/account"
            className="grid size-11 place-items-center rounded-btn hover:bg-sand"
            aria-label="Account"
          >
            <User className="size-6" aria-hidden />
          </Link>
          <BagButton />
        </div>
      </div>
    </header>
  );
}
