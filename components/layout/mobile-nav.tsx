'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { COLLECTION_LINKS, MAIN_NAV, HELP_LINKS } from '@/lib/site';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="grid size-12 place-items-center rounded-btn hover:bg-sand lg:hidden" aria-label="Open menu">
        <Menu className="size-6" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" title="Menu">
        <nav className="flex flex-col p-5" aria-label="Mobile">
          <SheetClose asChild>
            <Link href="/gift-boxes" onClick={close} className="display mb-4 flex min-h-14 items-center justify-between rounded-btn bg-ember px-5 text-2xl text-white">
              Gift Boxes <span aria-hidden>→</span>
            </Link>
          </SheetClose>
          <p className="mb-2 mt-2 text-xs font-semibold uppercase tracking-widest text-muted">Shop</p>
          <ul>
            {COLLECTION_LINKS.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} onClick={close} className="flex min-h-12 items-center border-b border-line text-lg font-semibold">{c.name}</Link>
              </li>
            ))}
            <li><Link href="/collections/all" onClick={close} className="flex min-h-12 items-center border-b border-line text-lg font-semibold">Shop all</Link></li>
          </ul>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-muted">More</p>
          <ul>
            {MAIN_NAV.filter((n) => !('highlight' in n && n.highlight)).map((n) => (
              <li key={n.href}><Link href={n.href} onClick={close} className="flex min-h-12 items-center border-b border-line text-lg font-semibold">{n.name}</Link></li>
            ))}
            <li><Link href="/gift-cards" onClick={close} className="flex min-h-12 items-center border-b border-line text-lg font-semibold">Gift cards</Link></li>
          </ul>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 text-sm text-muted">
            {HELP_LINKS.map((h) => (
              <li key={h.href}><Link href={h.href} onClick={close} className="flex min-h-11 items-center">{h.name}</Link></li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
