import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/admin/print-button';
import { adm, requirePerm } from '@/lib/admin/db';
import { fmtDate } from '@/components/admin/ui';

export const metadata = { title: 'Packing slip', robots: { index: false } };
type Sel = { label: string; productName: string; colour?: string; size?: string; option?: string; customText?: string };

/** A clean, light page meant for printing. No prices: it goes in the box. */
export default async function PackingSlip({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const me = await requirePerm(['orders', 'fulfilment'], `/admin/orders/${number}`);
  const o = await adm<{ number: string; created_at: string; promised_by: string | null; is_gift: boolean; gift_message: string | null; address: { recipient: string; phone: string; line1: string; area?: string; city: string; state: string }; items: { id: string; name: string; quantity: number; options: Record<string, string>; selections: Sel[] | null; gift_message: string | null; kind: string }[]; gift_wrap_kobo: number } | null>('admin_order_get', me, { number });
  if (!o) notFound();
  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-0" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between print:hidden"><a href={`/admin/orders/${o.number}`} className="text-sm underline">← Back to order</a><PrintButton /></div>
        <header className="flex items-end justify-between border-b-2 border-black pb-3"><h1 className="text-3xl font-black tracking-widest">PEMART</h1><div className="text-right"><p className="text-xl font-bold">{o.number}</p><p className="text-sm">Ordered {fmtDate(o.created_at)}{o.promised_by ? ` · due ${fmtDate(o.promised_by)}` : ''}</p></div></header>
        <section className="my-5"><h2 className="text-xs font-bold uppercase tracking-widest">Ship to</h2><p className="text-lg font-bold">{o.address.recipient}</p><p>{o.address.line1}{o.address.area ? `, ${o.address.area}` : ''}<br />{o.address.city}, {o.address.state}<br />{o.address.phone}</p></section>
        <table className="w-full border-collapse text-sm"><thead><tr className="border-b-2 border-black text-left"><th className="py-2">Qty</th><th>Item</th><th className="w-10 text-center">✓</th></tr></thead>
          <tbody>{o.items.map((i) => (
            <tr key={i.id} className="border-b border-gray-300 align-top"><td className="py-2 font-bold">{i.quantity}</td>
              <td className="py-2"><p className="font-semibold">{i.name}</p>{i.kind === 'variant' && <p>{[i.options.colour, i.options.size, i.options.option].filter(Boolean).join(' · ')}</p>}
                {i.selections && <ul className="mt-1">{i.selections.map((s) => (<li key={s.label}>☐ <strong>{s.label}:</strong> {[s.productName, s.colour, s.size, s.option, s.customText ? `"${s.customText}"` : ''].filter(Boolean).join(' · ')}</li>))}</ul>}
                {i.gift_message && <p className="mt-1 italic">Card: “{i.gift_message}”</p>}</td><td className="py-2 text-center text-xl">☐</td></tr>))}</tbody></table>
        {(o.is_gift || o.gift_wrap_kobo > 0) && <section className="mt-5 rounded border-2 border-black p-3"><p className="font-bold">🎁 Gift{o.gift_wrap_kobo > 0 ? ': wrap and card' : ''}</p>{o.gift_message && <p className="italic">“{o.gift_message}”</p>}</section>}
        <footer className="mt-8 border-t border-gray-400 pt-3 text-center text-xs">Wear what you believe. · Questions? Message us on WhatsApp.</footer>
      </div>
    </div>
  );
}
