'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import type { NavPanel } from '@/lib/navigation';

const row = 'flex min-h-14 w-full items-center justify-between border-b border-line text-left text-[15px] font-semibold uppercase tracking-[0.1em]';

/**
 * Mobile drawer: a drill-down rather than a shrunken mega menu. The top level lists each category;
 * opening one shows its links with a visible Back control. The sheet traps focus, closes on Escape
 * and locks page scroll.
 */
export function MobileNav({ panels }: { panels: NavPanel[] }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const active = panels.find((p) => p.id === section);
  const gifts = panels.find((p) => p.id === 'gifts');

  const done = () => { setOpen(false); setSection(null); };
  // Focus moves only after React has rendered the new view, so it never lands on a removed element.
  const focusNext = useRef<string | null>(null);
  const enter = (id: string) => { focusNext.current = 'back'; setSection(id); };
  const back = () => { focusNext.current = section; setSection(null); };
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'back') backRef.current?.focus();
    else if (target) triggerRefs.current[target]?.focus();
  }, [section]);

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSection(null); }}>
      <SheetTrigger className="-ml-2 grid size-11 place-items-center hover:bg-sand lg:hidden" aria-label="Open menu">
        <Menu className="size-6" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" title="Menu">
        <nav aria-label="Mobile" className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {!active ? (
            <div className="reveal">
              <ul>
                {panels.map((p) => (
                  <li key={p.id}>
                    <button
                      ref={(el) => { triggerRefs.current[p.id] = el; }}
                      type="button"
                      className={row}
                      aria-label={`${p.label}, open section`}
                      onClick={() => enter(p.id)}
                    >
                      {p.label}
                      <ChevronRight className="size-5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              {gifts && (
                <Link href="/gift-boxes" onClick={done} className="mt-6 flex min-h-14 items-center justify-center bg-ink text-sm font-semibold uppercase tracking-[0.14em] text-white">
                  Shop Gift Boxes
                </Link>
              )}
              <ul className="mt-6 space-y-1 text-[15px]">
                <li><Link href="/account" onClick={done} className="flex min-h-12 items-center">My account & wishlist</Link></li>
                <li><Link href="/track" onClick={done} className="flex min-h-12 items-center">Track an order</Link></li>
                <li><Link href="/contact" onClick={done} className="flex min-h-12 items-center">Contact & support</Link></li>
              </ul>
            </div>
          ) : (
            <div className="reveal">
              <button ref={backRef} type="button" onClick={back} className="-ml-1 flex min-h-12 items-center gap-1 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
                <ChevronLeft className="size-5" aria-hidden /> Back
              </button>
              <Link href={active.href} onClick={done} className="display mt-2 block text-4xl">
                {active.label}
              </Link>
              {active.columns.map((col) => (
                <div key={col.heading} className="mt-6">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{col.heading}</p>
                  <ul>
                    {col.links.map((l) => (
                      <li key={l.href + l.name}>
                        <Link href={l.href} onClick={done} className="flex min-h-12 items-center border-b border-line text-[15px]">
                          {l.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
