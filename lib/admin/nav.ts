import { can, type Access, type Permission } from './permissions';

export type NavIcon =
  | 'overview' | 'orders' | 'production' | 'proofs' | 'quotes' | 'customers' | 'catalogue' | 'website'
  | 'discounts' | 'reviews' | 'reports' | 'activity' | 'settings' | 'team' | 'help' | 'media' | 'payments';
/** need: a permission (any one of a list), 'admin' for owners only, or 'any' for every staff member. */
export type NavItem = { href: string; label: string; need: Permission[] | 'admin' | 'any'; icon: NavIcon };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * The admin sidebar. Only modules that exist are listed (no dead links). Staff see the areas their permissions
 * cover; admins see everything. Hiding a link is a convenience only: every page, action and database function re-checks the role.
 */
export const ADMIN_GROUPS: NavGroup[] = [
  { label: '', items: [{ href: '/admin', label: 'Overview', need: 'any', icon: 'overview' }] },
  {
    label: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', need: ['orders', 'fulfilment'], icon: 'orders' },
      { href: '/admin/production', label: 'Production board', need: ['fulfilment', 'orders'], icon: 'production' },
      { href: '/admin/proofs', label: 'Custom proofs', need: ['fulfilment', 'orders'], icon: 'proofs' },
      { href: '/admin/quotes', label: 'Bulk quotes', need: ['orders'], icon: 'quotes' },
      { href: '/admin/customers', label: 'Customers', need: ['customers'], icon: 'customers' },
    ],
  },
  {
    label: 'Catalogue',
    items: [{ href: '/admin/catalogue', label: 'Products & gift boxes', need: ['catalogue'], icon: 'catalogue' }],
  },
  {
    label: 'Website',
    items: [
      { href: '/admin/website', label: 'Website editor', need: ['content'], icon: 'website' },
      { href: '/admin/media', label: 'Media library', need: ['content', 'catalogue'], icon: 'media' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/admin/discounts', label: 'Discounts & ambassadors', need: ['marketing'], icon: 'discounts' },
      { href: '/admin/reviews', label: 'Reviews', need: ['reviews'], icon: 'reviews' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/admin/reports', label: 'Reports', need: ['reports'], icon: 'reports' },
      { href: '/admin/activity', label: 'Activity log', need: 'admin', icon: 'activity' },
    ],
  },
  {
    label: 'Store',
    items: [
      { href: '/admin/settings', label: 'Settings & delivery', need: 'admin', icon: 'settings' },
      { href: '/admin/payments', label: 'Payments status', need: 'admin', icon: 'payments' },
      { href: '/admin/team', label: 'Team & permissions', need: 'admin', icon: 'team' },
      { href: '/admin/help', label: 'Help', need: 'any', icon: 'help' },
    ],
  },
];

const allowed = (a: Access, i: NavItem) => (i.need === 'any' ? true : can(a, i.need));
export const navFor = (access: Access): NavGroup[] =>
  ADMIN_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed(access, i)) })).filter((g) => g.items.length);

/** Flat list kept for any older import. */
export const ADMIN_NAV: NavItem[] = ADMIN_GROUPS.flatMap((g) => g.items);

const EXTRA: Record<string, string> = { import: 'Import', search: 'Search', bundles: 'Gift box', products: 'Product', 'packing-slip': 'Packing slip', export: 'Export' };

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
