import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { Card, DataTable, PageTitle, fmtDate, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requireAdmin } from '@/lib/admin/db';
import { createAmbassadorAction, payCommissionAction, saveDiscountAction, toggleAmbassadorAction } from '@/lib/admin/actions-admin';
import { formatNaira } from '@/lib/money';

export const metadata: Metadata = { title: 'Discounts' };
type Code = { id: string; code: string; type: 'percentage' | 'fixed'; value: number; min_spend_kobo: number; starts_at: string | null; ends_at: string | null; usage_limit: number | null; per_customer_limit: number | null; times_used: number; ambassador: string | null; ambassador_id: string | null; is_active: boolean };
type Amb = { id: string; name: string; code: string; phone: string | null; email: string | null; commission_rate: number; is_active: boolean; payout_note: string | null; orders: number; sales_kobo: number; owed_kobo: number; paid_kobo: number };

export default async function DiscountsPage() {
  const me = await requireAdmin('/admin/discounts');
  const { codes, ambassadors } = await adm<{ codes: Code[]; ambassadors: Amb[] }>('admin_discounts_list', me);
  const plain = codes.filter((c) => !c.ambassador_id);
  return (
    <>
      <PageTitle title="Discounts and ambassadors" />
      <h2 className="display mb-3 text-3xl">Discount codes</h2>
      <DataTable caption="Discount codes" head={['Code', 'Discount', 'Min spend', 'Valid', 'Used', 'Status']}>
        {plain.map((c) => (<tr key={c.id}><td className="px-3 py-2.5 font-bold">{c.code}</td><td className="px-3 py-2.5">{c.type === 'percentage' ? `${c.value}%` : formatNaira(c.value)}</td><td className="px-3 py-2.5">{c.min_spend_kobo ? formatNaira(c.min_spend_kobo) : '—'}</td>
          <td className="px-3 py-2.5">{c.starts_at || c.ends_at ? `${fmtDate(c.starts_at)} to ${c.ends_at ? fmtDate(c.ends_at) : 'no end'}` : 'Always'}</td><td className="px-3 py-2.5">{c.times_used}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
          <td className="px-3 py-2.5"><ActionForm action={saveDiscountAction} hideSubmit className="flex items-center gap-2"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="type" value={c.type} /><input type="hidden" name="value" value={c.type === 'percentage' ? c.value : c.value / 100} />
            <label className="flex min-h-11 items-center gap-1"><input type="checkbox" name="is_active" defaultChecked={c.is_active} className="size-5 accent-ink" />Active</label><button className="min-h-11 rounded-btn border-2 border-ink px-3 text-sm font-semibold">Save</button></ActionForm></td></tr>))}
      </DataTable>
      <Card title="New discount code" className="mt-4"><ActionForm action={saveDiscountAction} submitLabel="Create code" pendingLabel="Creating…" resetOnSuccess>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className={labelCls} htmlFor="dc">Code</label><input id="dc" name="code" required placeholder="WELCOME15" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="dt">Type</label><select id="dt" name="type" className={inputCls}><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off</option></select></div>
          <div><label className={labelCls} htmlFor="dv">Value (% or ₦)</label><input id="dv" name="value" required inputMode="decimal" placeholder="10" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="dm">Minimum spend (₦)</label><input id="dm" name="min_spend" inputMode="decimal" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ds">Starts</label><input id="ds" name="starts_at" type="date" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="de">Ends</label><input id="de" name="ends_at" type="date" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="du">Total uses allowed</label><input id="du" name="usage_limit" type="number" min={1} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="dp">Uses per customer</label><input id="dp" name="per_customer_limit" type="number" min={1} className={inputCls} /></div></div>
        <input type="hidden" name="is_active" value="on" />
      </ActionForm></Card>

      <h2 className="display mb-3 mt-10 text-3xl">Ambassadors</h2>
      {ambassadors.length === 0 ? <p className="text-muted">No ambassadors yet.</p> : (
        <DataTable caption="Ambassadors" head={['Ambassador', 'Code', 'Orders', 'Sales', 'Commission owed', 'Paid', '']}>
          {ambassadors.map((a) => (<tr key={a.id} className={a.is_active ? '' : 'opacity-60'}><td className="px-3 py-2.5 font-semibold">{a.name}<div className="text-xs font-normal text-muted">{a.phone ?? a.email ?? ''}</div></td><td className="px-3 py-2.5 font-bold">{a.code}</td><td className="px-3 py-2.5">{a.orders}</td><td className="px-3 py-2.5">{formatNaira(a.sales_kobo)}</td>
            <td className="px-3 py-2.5 font-bold">{formatNaira(a.owed_kobo)}</td><td className="px-3 py-2.5">{formatNaira(a.paid_kobo)}</td>
            <td className="px-3 py-2.5"><div className="flex flex-wrap gap-2">{a.owed_kobo > 0 && <ActionForm action={payCommissionAction} submitLabel="Mark as paid" pendingLabel="Saving…"><input type="hidden" name="ambassadorId" value={a.id} /></ActionForm>}
              <ActionForm action={toggleAmbassadorAction} hideSubmit className="flex items-center gap-2"><input type="hidden" name="id" value={a.id} /><input type="hidden" name="payout_note" value={a.payout_note ?? ''} /><label className="flex min-h-11 items-center gap-1 text-xs"><input type="checkbox" name="is_active" defaultChecked={a.is_active} className="size-5 accent-ink" />Active</label><button className="min-h-11 rounded-btn border-2 border-ink px-3 text-xs font-semibold">Save</button></ActionForm></div></td></tr>))}
        </DataTable>)}
      <Card title="New ambassador" className="mt-4"><ActionForm action={createAmbassadorAction} submitLabel="Create ambassador" pendingLabel="Creating…" resetOnSuccess>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className={labelCls} htmlFor="an">Name</label><input id="an" name="name" required className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ac">Their personal code</label><input id="ac" name="code" required placeholder="TOLU10" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ap">Phone</label><input id="ap" name="phone" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="ae">Email</label><input id="ae" name="email" type="email" className={inputCls} /></div>
          <div className="sm:col-span-2 lg:col-span-4"><label className={labelCls} htmlFor="ano">Payout note (a reference only: never card or full account numbers)</label><input id="ano" name="payout_note" placeholder="e.g. Pay on the 5th, GTB (ask Ade)" className={inputCls} /></div></div>
        <p className="mt-2 text-sm text-muted">Buyers who use the code get 10% off. The ambassador earns 10% of the order subtotal as a pending commission.</p></ActionForm></Card>
    </>
  );
}
