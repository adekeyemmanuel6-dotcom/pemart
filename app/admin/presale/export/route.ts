import { adm, requirePerm } from '@/lib/admin/db';
import { csvResponse, toCsv } from '@/lib/admin/csv';
import { GARMENT_LABEL, SIZES, type PresaleItem } from '@/lib/presale/schema';

export const dynamic = 'force-dynamic';

type Row = { reference: string; created_at: string; status: string; name: string; phone: string; email: string; state: string; city: string; address: string | null; items: PresaleItem[]; total_qty: number; notes: string | null; admin_note: string | null; whatsapp_updates: boolean };

/** Every pre-order as a spreadsheet: one row per request, one column per garment and size. Orders permission (also checked in the database). */
export async function GET() {
  const me = await requirePerm('orders', '/admin/presale');
  const { requests } = await adm<{ requests: Row[] }>('admin_presale_list', me, {});
  const cols = (['tee', 'sweatshirt', 'hoodie'] as const).flatMap((g) => SIZES.map((s) => ({ g, s })));
  const qty = (r: Row, g: string, s: string) => r.items.find((i) => i.garment === g)?.sizes[s as keyof PresaleItem['sizes']] ?? 0;
  return csvResponse('presale-requests.csv', toCsv(
    ['Reference', 'Date', 'Status', 'Name', 'WhatsApp', 'Email', 'State', 'City', 'Address', ...cols.map((c) => `${GARMENT_LABEL[c.g]} ${c.s}`), 'Total pieces', 'Notes', 'Team note', 'WhatsApp updates'],
    requests.map((r) => [r.reference, r.created_at.slice(0, 10), r.status, r.name, r.phone, r.email, r.state, r.city, r.address, ...cols.map((c) => qty(r, c.g, c.s)), r.total_qty, r.notes, r.admin_note, r.whatsapp_updates ? 'yes' : 'no']),
  ));
}
