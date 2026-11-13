import type { Role } from '@/lib/auth';

export type NavIcon =
  | 'overview' | 'orders' | 'production' | 'proofs' | 'quotes' | 'customers' | 'catalogue' | 'website'
  | 'discounts' | 'reviews' | 'reports' | 'activity' | 'settings' | 'team' | 'help';
export type NavItem = { href: string; label: string; roles: Role[]; icon: NavIcon };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * The admin sidebar. Only modules that exist are listed (no dead links). Staff see operations; admins see
 * everything. Hiding a link is a convenience only: every page, action and database function re-checks the role.
 */
export const ADMIN_GROUPS: NavGroup[] = [
  { label: '', items: [{ href: '/admin', label: 'Overview', roles: ['staff', 'admin'], icon: 'overview' }] },
  {
    label: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', roles: ['staff', 'admin'], icon: 'orders' },
      { href: '/admin/production', label: 'Production board', roles: ['staff', 'admin'], icon: 'production' },
      { href: '/admin/proofs', label: 'Custom proofs', roles: ['staff', 'admin'], icon: 'proofs' },
      { href: '/admin/quotes', label: 'Bulk quotes', roles: ['staff', 'admin'], icon: 'quotes' },
      { href: '/admin/customers', label: 'Customers', roles: ['staff', 'admin'], icon: 'customers' },
    ],
  },
  {
    label: 'Catalogue',
    items: [{ href: '/admin/catalogue', label: 'Products & gift boxes', roles: ['admin'], icon: 'catalogue' }],
  },
  {
    label: 'Website',
    items: [{ href: '/admin/website', label: 'Website editor', roles: ['admin'], icon: 'website' }],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/admin/discounts', label: 'Discounts & ambassadors', roles: ['admin'], icon: 'discounts' },
      { href: '/admin/reviews', label: 'Reviews', roles: ['staff', 'admin'], icon: 'reviews' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/admin/reports', label: 'Reports', roles: ['admin'], icon: 'reports' },
      { href: '/admin/activity', label: 'Activity log', roles: ['admin'], icon: 'activity' },
    ],
  },
  {
    label: 'Store',
    items: [
      { href: '/admin/settings', label: 'Settings & delivery', roles: ['admin'], icon: 'settings' },
      { href: '/admin/team', label: 'Team & permissions', roles: ['admin'], icon: 'team' },
      { href: '/admin/help', label: 'Help', roles: ['staff', 'admin'], icon: 'help' },
    ],
  },
];

export const navFor = (role: Role): NavGroup[] =>
  ADMIN_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);

/** Flat list kept for any older import. */
export const ADMIN_NAV: NavItem[] = ADMIN_GROUPS.flatMap((g) => g.items);

const EXTRA: Record<string, string> = { search: 'Search', bundles: 'Gift box', products: 'Product', 'packing-slip': 'Packing slip', export: 'Export' };

/** Breadcrumb trail for a path, e.g. /admin/orders/PM-10001 → Admin › Sales › Orders › PM-10001. */
export function breadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [{ label: 'Admin', href: '/admin' }];
  if (pathname === '/admin') return [{ label: 'Admin' }];
  const parts = pathname.split('/').filter(Boolean).slice(1);
  const base = `/admin/${parts[0]}`;
  const group = ADMIN_GROUPS.find((g) => g.items.some((i) => i.href === base));
  const item = group?.items.find((i) => i.href === base);
  if (group?.label) crumbs.push({ label: group.label });
  crumbs.push({ label: item?.label ?? EXTRA[parts[0]!] ?? parts[0]!, href: parts.length > 1 ? base : undefined });
  for (const p of parts.slice(1)) crumbs.push({ label: EXTRA[p] ?? decodeURIComponent(p) });
  // Long ids are noise in a breadcrumb.
  return crumbs.map((c) => (/^[0-9a-f-]{36}$/i.test(c.label) ? { ...c, label: 'Edit' } : c));
}
