import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminUploader } from '@/components/admin/admin-uploader';
import { Card, PageTitle, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requireAdmin } from '@/lib/admin/db';
import { saveSettingsAction, saveZoneAction } from '@/lib/admin/actions-admin';

export const metadata: Metadata = { title: 'Settings' };
type S = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Zone = { id: string; name: string; states: string[]; fee_kobo: number; free_over_kobo: number | null; lead_days: number; christmas_cutoff_date: string | null };
const n = (k: number | null | undefined) => (k === null || k === undefined ? '' : String(k / 100));

export default async function SettingsPage() {
  const me = await requireAdmin('/admin/settings');
  const { settings: s, zones, products } = await adm<{ settings: S; zones: Zone[]; products: { id: string; name: string }[] }>('admin_settings_get', me);
  const Check = ({ name, label, on }: { name: string; label: string; on: boolean }) => (<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={on} className="size-5 accent-ink" />{label}</label>);
  return (
    <>
      <PageTitle title="Settings" sub="Prices here are in Naira. Changes reach the store within a few minutes." />
      <ActionForm action={saveSettingsAction} submitLabel="Save settings" pendingLabel="Saving…">
        <div className="space-y-4">
          <Card title="Announcement bar">
            <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelCls} htmlFor="at">Text</label><input id="at" name="announcement_text" defaultValue={s.announcement_text ?? ''} className={inputCls} placeholder="Order by 17 Dec for Christmas delivery in Lagos" /></div>
              <div><label className={labelCls} htmlFor="al">Link (optional)</label><input id="al" name="announcement_link" defaultValue={s.announcement_link ?? ''} className={inputCls} placeholder="/gift-boxes" /></div><div className="flex items-end"><Check name="announcement_active" label="Show the bar" on={s.announcement_active} /></div></div>
          </Card>
          <Card title="Brand and contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><AdminUploader bucket="catalogue" name="logo_url" label="Logo (PNG, SVG or JPG). Leave empty to use the PEMART wordmark." accept=".png,.jpg,.jpeg,.svg,.webp" initial={s.logo_url ?? ''} />{s.logo_url && <p className="text-sm text-muted">Current logo: <a href={s.logo_url} className="underline" target="_blank" rel="noopener noreferrer">{s.logo_url}</a></p>}</div>
              <div><label className={labelCls} htmlFor="wa">WhatsApp number (digits, international)</label><input id="wa" name="whatsapp_number" defaultValue={s.whatsapp_number ?? ''} placeholder="2348031234567" inputMode="numeric" className={inputCls} /></div><div />
              <div><label className={labelCls} htmlFor="ig">Instagram URL</label><input id="ig" name="instagram_url" defaultValue={s.instagram_url ?? ''} placeholder="https://instagram.com/…" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="tk">TikTok URL</label><input id="tk" name="tiktok_url" defaultValue={s.tiktok_url ?? ''} placeholder="https://tiktok.com/@…" className={inputCls} /></div></div>
          </Card>
          <Card title="Add-ons and fees (₦)">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={labelCls} htmlFor="gw">Gift wrap and card</label><input id="gw" name="gift_wrap" defaultValue={n(s.gift_wrap_kobo)} inputMode="decimal" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="sn">Surprise delivery note (Lagos)</label><input id="sn" name="surprise_note" defaultValue={n(s.surprise_note_kobo)} inputMode="decimal" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="ex">Express 48-hour production</label><input id="ex" name="express" defaultValue={n(s.express_kobo)} inputMode="decimal" className={inputCls} /><div className="mt-1"><Check name="express_enabled" label="Offer express" on={s.express_enabled} /></div></div>
              <div><label className={labelCls} htmlFor="rf">Extra design revision</label><input id="rf" name="revision_fee" defaultValue={n(s.revision_fee_kobo)} inputMode="decimal" className={inputCls} /></div>
              <div><label className={labelCls} htmlFor="rc">Store credit for a photo review</label><input id="rc" name="review_credit" defaultValue={n(s.review_credit_kobo)} inputMode="decimal" className={inputCls} /></div></div>
          </Card>
          <Card title="Bag offer (upsell)">
            <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelCls} htmlFor="up">Product offered in the bag</label><select id="up" name="upsell_product_id" defaultValue={s.upsell_product_id ?? ''} className={inputCls}><option value="">No offer</option>{products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
              <div><label className={labelCls} htmlFor="upp">Special price (₦)</label><input id="upp" name="upsell_price" defaultValue={n(s.upsell_price_kobo)} inputMode="decimal" className={inputCls} /></div></div>
          </Card>
          <Card title="Store status">
            <Check name="maintenance_mode" label="Maintenance mode: shows a &quot;back soon&quot; page to shoppers and stops new orders. The admin stays available." on={s.maintenance_mode} />
            <p className="mt-2 text-sm text-muted">Pay on delivery is not offered at launch{s.pay_on_delivery_enabled ? ' (a flag is set but not wired to checkout yet)' : ''}.</p>
          </Card>
        </div>
      </ActionForm>

      <h2 className="display mb-3 mt-10 text-3xl">Delivery zones</h2>
      <p className="mb-3 text-sm text-muted">Fees, free-delivery thresholds, delivery days and the Christmas order cutoff for each area. These are the numbers shoppers see and are charged.</p>
      <div className="space-y-3">{zones.map((z) => (
        <Card key={z.id}><ActionForm action={saveZoneAction} submitLabel={`Save ${z.name}`} pendingLabel="Saving…"><input type="hidden" name="id" value={z.id} />
          <p className="mb-2 font-bold">{z.name} <span className="text-sm font-normal text-muted">({z.states.length} {z.states.length === 1 ? 'state' : 'states'})</span></p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={labelCls} htmlFor={`f-${z.id}`}>Delivery fee (₦)</label><input id={`f-${z.id}`} name="fee" defaultValue={n(z.fee_kobo)} inputMode="decimal" required className={inputCls} /></div>
            <div><label className={labelCls} htmlFor={`o-${z.id}`}>Free over (₦, blank = never)</label><input id={`o-${z.id}`} name="free_over" defaultValue={n(z.free_over_kobo)} inputMode="decimal" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor={`l-${z.id}`}>Delivery days</label><input id={`l-${z.id}`} name="lead_days" type="number" min={0} defaultValue={z.lead_days} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor={`c-${z.id}`}>Christmas cutoff date</label><input id={`c-${z.id}`} name="cutoff" type="date" defaultValue={z.christmas_cutoff_date ?? ''} className={inputCls} /></div></div></ActionForm></Card>))}</div>
    </>
  );
}
