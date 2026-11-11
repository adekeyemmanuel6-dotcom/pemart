import type { Role } from '@/lib/auth';

export type NavItem = { href: string; label: string; roles: Role[] };
/** Staff see operations. Admins see everything. (Enforced again on every page, action and database function.) */
export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', roles: ['staff', 'admin'] },
  { href: '/admin/orders', label: 'Orders', roles: ['staff', 'admin'] },
  { href: '/admin/production', label: 'Production', roles: ['staff', 'admin'] },
  { href: '/admin/proofs', label: 'Proofs', roles: ['staff', 'admin'] },
  { href: '/admin/quotes', label: 'Bulk quotes', roles: ['staff', 'admin'] },
  { href: '/admin/reviews', label: 'Reviews', roles: ['staff', 'admin'] },
  { href: '/admin/customers', label: 'Customers', roles: ['staff', 'admin'] },
  { href: '/admin/catalogue', label: 'Catalogue', roles: ['admin'] },
  { href: '/admin/discounts', label: 'Discounts', roles: ['admin'] },
  { href: '/admin/reports', label: 'Reports', roles: ['admin'] },
  { href: '/admin/settings', label: 'Settings', roles: ['admin'] },
  { href: '/admin/help', label: 'Help', roles: ['staff', 'admin'] },
];
