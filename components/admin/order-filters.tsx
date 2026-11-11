import { inputCls, labelCls } from './ui';
import { ORDER_STATUSES, STATUS_LABEL } from '@/lib/orders/status';

export function OrderFilters({ sp, zones }: { sp: Record<string, string | string[] | undefined>; zones: string[] }) {
  const v = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  return (
    <form method="get" className="mb-4 grid gap-3 rounded-lg border border-line bg-sand/40 p-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Filter orders">
      <div className="sm:col-span-2"><label htmlFor="f-q" className={labelCls}>Search</label><input id="f-q" name="q" defaultValue={v('q')} placeholder="Number, name, phone or email" className={inputCls} /></div>
      <div><label htmlFor="f-status" className={labelCls}>Status</label><select id="f-status" name="status" defaultValue={v('status')} className={inputCls}><option value="">Any</option>{ORDER_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}</select></div>
      <div><label htmlFor="f-zone" className={labelCls}>Zone</label><select id="f-zone" name="zone" defaultValue={v('zone')} className={inputCls}><option value="">Any</option>{zones.map((z) => (<option key={z}>{z}</option>))}</select></div>
      <div><label htmlFor="f-custom" className={labelCls}>Custom</label><select id="f-custom" name="custom" defaultValue={v('custom')} className={inputCls}><option value="">Any</option><option value="true">Custom only</option><option value="false">Ready only</option></select></div>
      <div className="flex items-end gap-2"><button className="min-h-11 flex-1 rounded-btn bg-ink px-4 text-sm font-semibold text-paper">Filter</button><a href="/admin/orders" className="inline-flex min-h-11 items-center px-2 text-sm underline">Clear</a></div>
      <div><label htmlFor="f-from" className={labelCls}>Promised from</label><input id="f-from" type="date" name="promised_from" defaultValue={v('promised_from')} className={inputCls} /></div>
      <div><label htmlFor="f-to" className={labelCls}>Promised to</label><input id="f-to" type="date" name="promised_to" defaultValue={v('promised_to')} className={inputCls} /></div>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" name="include_unpaid" value="true" defaultChecked={v('include_unpaid') === 'true'} className="size-5 accent-ink" />Include unpaid</label>
    </form>
  );
}
