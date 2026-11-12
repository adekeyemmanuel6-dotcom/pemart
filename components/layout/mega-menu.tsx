'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NavPanel } from '@/lib/navigation';

const OPEN_DELAY = 120; // hover intent: a pointer passing over the bar does not flash a panel
const CLOSE_DELAY = 180;

/**
 * Desktop mega menu (disclosure pattern). Hover opens after a short delay, click or Enter toggles,
 * Escape closes and returns focus to the trigger, and focus leaving the menu closes it.
 * Panels span the header width and sit flush under it, so the pointer never crosses a gap.
 */
export function MegaMenu({ panels }: { panels: NavPanel[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const pathname = usePathname() ?? '';

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const schedule = (id: string | null, delay: number) => { clear(); timer.current = setTimeout(() => setOpenId(id), delay); };
  const close = useCallback((returnFocus = false) => {
    clear();
    setOpenId((current) => {
      if (returnFocus && current) triggers.current[current]?.focus();
      return null;
    });
  }, []);

  useEffect(() => close(), [pathname, close]);
  useEffect(() => clear, []);
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [openId, close]);

  const active = panels.find((p) => p.id === openId);

  return (
    <div
      ref={root}
      onMouseLeave={() => schedule(null, CLOSE_DELAY)}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node | null)) close(); }}
    >
      <ul className="flex items-center">
        {panels.map((p) => {
          const isOpen = openId === p.id;
          const current = pathname === p.href || (p.href !== '/' && pathname.startsWith(p.href.split('?')[0]!));
          return (
            <li key={p.id}>
              <button
                ref={(el) => { triggers.current[p.id] = el; }}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`menu-${p.id}`}
                onClick={() => { clear(); setOpenId(isOpen ? null : p.id); }}
                onMouseEnter={() => schedule(p.id, openId ? 0 : OPEN_DELAY)}
                className={`relative inline-flex h-16 items-center gap-1 px-2 text-[12px] font-semibold uppercase tracking-[0.08em] xl:px-3 xl:text-[13px] xl:tracking-[0.12em] transition-colors duration-150 hover:text-ink ${isOpen || current ? 'text-ink' : 'text-charcoal'}`}
              >
                {p.label}
                <ChevronDown className={`size-3.5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                <span className={`absolute inset-x-2 bottom-4 xl:inset-x-3 h-px bg-ink transition-transform duration-200 motion-reduce:transition-none ${isOpen || current ? 'scale-x-100' : 'scale-x-0'}`} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {panels.map((p) => (
        <div
          key={p.id}
          id={`menu-${p.id}`}
          hidden={p.id !== active?.id}
          onMouseEnter={clear}
          className="mega-panel absolute inset-x-0 top-full z-40 border-b border-t border-line bg-white shadow-[0_12px_24px_-16px_rgb(0_0_0/0.25)]"
        >
          <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-8 px-8 py-10 xl:px-16">
            <div className={`grid gap-8 ${p.feature ? 'col-span-8' : 'col-span-12'}`} style={{ gridTemplateColumns: `repeat(${Math.max(p.columns.length, 1)}, minmax(0, 1fr))` }}>
              {p.columns.map((col) => (
                <div key={col.heading}>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{col.heading}</p>
                  <ul className="space-y-1">
                    {col.links.map((l) => (
                      <li key={l.href + l.name}>
                        <Link href={l.href} onClick={() => close()} className="inline-block py-1.5 text-[15px] text-ink underline-offset-4 hover:underline">
                          {l.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {p.feature && (
              <Link href={p.feature.href} onClick={() => close()} className="group col-span-4 block">
                <div className="relative aspect-[4/3] overflow-hidden bg-sand">
                  {p.feature.image ? (
                    <Image src={p.feature.image} alt={p.feature.imageAlt} fill sizes="(min-width: 1440px) 440px, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-ink p-6 text-center text-white">
                      <p className="display text-4xl leading-none">{p.feature.title}</p>
                    </div>
                  )}
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{p.feature.eyebrow}</p>
                {p.feature.image && <p className="display mt-1 text-2xl">{p.feature.title}</p>}
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] underline underline-offset-4">{p.feature.cta}</p>
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
