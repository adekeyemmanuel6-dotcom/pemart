'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PRODUCT_TYPE_LINKS } from '@/lib/site';
import type { WebsiteLink } from '@/lib/website/schema';

/** Shop mega menu: by collection and by product type. Opens on hover, focus or click; Esc closes. */
export function MegaMenu({ links }: { links: WebsiteLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="shop-menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-12 items-center gap-1 px-3 text-base font-semibold hover:text-denim"
      >
        Shop{' '}
        <ChevronDown className={`size-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div
          id="shop-menu"
          className="reveal absolute left-0 top-full z-40 w-[640px] rounded-b-lg border border-line bg-paper p-6 shadow-lg"
        >
          <div className="grid grid-cols-[1.4fr_1fr] gap-8">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">By collection</p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
                {links.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} onClick={() => setOpen(false)} className="block hover:text-denim">
                      <span className="display block text-xl">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">By type</p>
              <ul className="space-y-2">
                {PRODUCT_TYPE_LINKS.map((t) => (
                  <li key={t.href}>
                    <Link
                      href={t.href}
                      onClick={() => setOpen(false)}
                      className="block py-1 font-medium hover:text-denim"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/collections/all"
                    onClick={() => setOpen(false)}
                    className="mt-2 inline-block border-b-2 border-ink pb-0.5 font-semibold"
                  >
                    Shop everything
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
