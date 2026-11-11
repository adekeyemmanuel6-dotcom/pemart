'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/admin/nav';

/** Horizontally scrollable on phones, so orders can be handled on the go. */
export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((i) => {
          const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
          return (<li key={i.href}><Link href={i.href} aria-current={active ? 'page' : undefined} className={`inline-flex min-h-12 items-center whitespace-nowrap rounded-t-md border-b-[3px] px-3 text-sm font-semibold ${active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{i.label}</Link></li>);
        })}
      </ul>
    </nav>
  );
}
