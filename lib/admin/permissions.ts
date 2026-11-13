/** Staff permissions (migration 0019). Admins (owners) always have all of them plus settings, team and activity. */
export const PERMISSIONS = ['orders', 'fulfilment', 'customers', 'reviews', 'catalogue', 'content', 'marketing', 'reports'] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; detail: string }> = {
  orders: { label: 'Orders', detail: 'View and update orders, notes, refunds records and bulk quotes' },
  fulfilment: { label: 'Fulfilment', detail: 'Production board, custom proofs, order status' },
  customers: { label: 'Customers', detail: 'Customer list and export' },
  reviews: { label: 'Reviews', detail: 'Approve or reject reviews' },
  catalogue: { label: 'Catalogue', detail: 'Products, gift boxes, stock, collections, CSV import' },
  content: { label: 'Website content', detail: 'Website editor, homepage, menu, pages, media library' },
  marketing: { label: 'Marketing', detail: 'Discount codes and ambassadors (not commission payouts)' },
  reports: { label: 'Reports', detail: 'Sales reports and exports' },
};

export const PRESETS: { id: string; label: string; detail: string; permissions: Permission[] }[] = [
  { id: 'store_manager', label: 'Store Manager', detail: 'Runs the shop day to day', permissions: ['orders', 'fulfilment', 'customers', 'reviews', 'catalogue', 'reports'] },
  { id: 'content_editor', label: 'Content Editor', detail: 'Website, media and promotions', permissions: ['content', 'marketing', 'reviews'] },
  { id: 'fulfilment', label: 'Fulfilment', detail: 'Packs and ships orders', permissions: ['orders', 'fulfilment'] },
  { id: 'support', label: 'Support', detail: 'Answers customers', permissions: ['orders', 'customers', 'reviews'] },
];

/** What a Staff account could do before detailed roles existed (and still can, until an admin changes it). */
export const LEGACY_STAFF: Permission[] = ['orders', 'fulfilment', 'customers', 'reviews'];

export type Access = { role: 'staff' | 'admin'; permissions: Permission[]; preset: string | null };

export const can = (a: Access | null, need: Permission | Permission[] | 'admin'): boolean => {
  if (!a) return false;
  if (a.role === 'admin') return true;
  if (need === 'admin') return false;
  const list = Array.isArray(need) ? need : [need];
  return list.some((p) => a.permissions.includes(p));
};

export const presetLabel = (a: Pick<Access, 'role' | 'preset' | 'permissions'>): string => {
  if (a.role === 'admin') return 'Owner (admin)';
  const p = PRESETS.find((x) => x.id === a.preset);
  if (p && p.permissions.length === a.permissions.length && p.permissions.every((x) => a.permissions.includes(x))) return p.label;
  return 'Staff (custom)';
};
