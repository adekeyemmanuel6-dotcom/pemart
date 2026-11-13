'use client';
import Image from 'next/image';
import Link from 'next/link';
import { DEFAULT_LOGO } from '@/components/layout/logo';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity, BarChart3, BookOpen, ChevronRight, ClipboardList, Factory, Gift, Globe, HelpCircle, LayoutDashboard,
  Menu, MessageSquareQuote, PanelLeftClose, PanelLeftOpen, Percent, Search, Settings, ShieldCheck, Star, Users, UsersRound,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { breadcrumbs, type NavGroup, type NavIcon } from '@/lib/admin/nav';

const ICONS: Record<NavIcon, typeof Activity> = {
  overview: LayoutDashboard, orders: ClipboardList, production: Factory, proofs: MessageSquareQuote, quotes: BookOpen,
  customers: Users, catalogue: Gift, website: Globe, discounts: Percent, reviews: Star, reports: BarChart3,
  activity: Activity, settings: Settings, team: UsersRound, help: HelpCircle,
};
const STORE_KEY = 'pemart-admin-sidebar';

function NavList({ groups, collapsed, onNavigate }: { groups: NavGroup[]; collapsed: boolean; onNavigate?: () => void }) {
  const path = usePathname() ?? '';
  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((g) => (
        <div key={g.label || 'top'} className="mb-3">
          {g.label && !collapsed && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{g.label}</p>}
          {g.label && collapsed && <hr className="mx-3 mb-2 border-line" aria-hidden />}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const Icon = ICONS[i.icon];
              const active = i.href === '/admin' ? path === '/admin' : path === i.href || path.startsWith(`${i.href}/`);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? i.label : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 ${
                      active ? 'bg-ink text-paper' : 'text-ink/85 hover:bg-sand'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    <span className={collapsed ? 'sr-only' : ''}>{i.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu({ email, role }: { email: string | null; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const initial = (email ?? '?').slice(0, 1).toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-sand" aria-label="Account menu">
        <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-bold text-paper" aria-hidden>{initial}</span>
        <span className="hidden max-w-40 truncate text-sm md:inline">{email}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-64 rounded-md border border-line bg-paper p-2 shadow-xl">
          <div className="border-b border-line px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold">{email}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-3.5" aria-hidden />{role === 'admin' ? 'Admin' : 'Staff'} · two-factor on</p>
          </div>
          <Link role="menuitem" href="/" className="flex min-h-11 items-center rounded px-3 text-sm hover:bg-sand">View store</Link>
          <Link role="menuitem" href="/account" className="flex min-h-11 items-center rounded px-3 text-sm hover:bg-sand">My account</Link>
          <form action="/auth/sign-out" method="post">
            <button role="menuitem" className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm hover:bg-sand">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * Admin chrome: grouped sidebar (collapsible on desktop, a drawer on phones and tablets), a top bar with
 * breadcrumbs, global search and the account menu.
 */
export function AdminShell({ groups, email, role, children }: { groups: NavGroup[]; email: string | null; role: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const path = usePathname() ?? '/admin';
  const crumbs = breadcrumbs(path);
  useEffect(() => { try { setCollapsed(localStorage.getItem(STORE_KEY) === '1'); } catch { /* storage unavailable */ } }, []);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(STORE_KEY, c ? '0' : '1'); } catch { /* ignore */ } return !c; });

  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-paper transition-[width] duration-200 motion-reduce:transition-none lg:flex print:hidden ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className={`flex h-14 items-center border-b border-line ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
          {!collapsed && <Link href="/admin" aria-label="Wear The Word admin home" className="flex items-center gap-2"><Image src={DEFAULT_LOGO.dark} alt="" width={458} height={480} className="h-10 w-auto" /><span className="text-xs uppercase tracking-[0.14em] text-muted">Admin</span></Link>}
          <button type="button" onClick={toggle} className="grid size-9 place-items-center rounded-md hover:bg-sand" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}>
            {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
          </button>
        </div>
        <NavList groups={groups} collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/95 px-3 backdrop-blur sm:px-5 print:hidden">
          <Sheet open={drawer} onOpenChange={setDrawer}>
            <SheetTrigger className="grid size-11 place-items-center rounded-md hover:bg-sand lg:hidden" aria-label="Open admin menu">
              <Menu className="size-5" aria-hidden />
            </SheetTrigger>
            <SheetContent side="left" title="Admin" className="admin-theme text-ink">
              <NavList groups={groups} collapsed={false} onNavigate={() => setDrawer(false)} />
            </SheetContent>
          </Sheet>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 sm:block">
            <ol className="flex items-center gap-1 truncate text-sm text-muted">
              {crumbs.map((c, i) => (
                <li key={i} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
                  {c.href && i < crumbs.length - 1 ? (
                    <Link href={c.href} className="truncate hover:text-ink">{c.label}</Link>
                  ) : (
                    <span className={`truncate ${i === crumbs.length - 1 ? 'font-semibold text-ink' : ''}`} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <form action="/admin/search" method="get" role="search" className="ml-auto flex min-w-0 flex-1 items-center sm:max-w-xs sm:flex-none">
            <label htmlFor="admin-q" className="sr-only">Search orders, customers and products</label>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input id="admin-q" name="q" type="search" placeholder="Search orders, customers, products" defaultValue={path === '/admin/search' ? undefined : ''}
                className="min-h-10 w-full rounded-md border border-line bg-sand/60 pl-9 pr-3 text-sm placeholder:text-muted" />
            </div>
          </form>
          <AccountMenu email={email} role={role} />
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
