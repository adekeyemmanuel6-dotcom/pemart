'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import type { WebsiteContent } from '@/lib/website/schema';
export function MobileNav({ navigation }: { navigation: WebsiteContent['navigation'] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="grid size-12 place-items-center rounded-btn hover:bg-sand lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-6" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" title="Menu">
        <nav className="flex flex-col p-5" aria-label="Mobile">
          {(['main', 'shop', 'help'] as const).map((group) => (
            <div key={group}>
              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-muted">
                {group === 'main' ? 'Explore' : group}
              </p>
              <ul>
                {navigation[group].map((link, i) => (
                  <li key={i}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center border-b border-line font-semibold"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="mt-5 flex min-h-12 items-center font-semibold"
          >
            My account & wishlist
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
