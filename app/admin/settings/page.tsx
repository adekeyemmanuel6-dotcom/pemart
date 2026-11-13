import { ShippingZoneForm } from '@/components/admin/shipping-zone-form';
import type { DeliveryZone } from '@/lib/catalogue/types';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import Link from 'next/link';
import { CryptoSettings } from '@/components/admin/crypto-settings';
import { Card, PageTitle, inputCls, labelCls } from '@/components/admin/ui';
import { adm, requireAdmin } from '@/lib/admin/db';
import { saveSettingsAction } from '@/lib/admin/actions-admin';

export const metadata: Metadata = { title: 'Settings' };
type S = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Zone = DeliveryZone;
const n = (k: number | null | undefined) => (k === null || k === undefined ? '' : String(k / 100));

export default async function SettingsPage() {
  const me = await requireAdmin('/admin/settings');
  const {
    settings: s,
    zones,
    products,
  } = await adm<{ settings: S; zones: Zone[]; products: { id: string; name: string }[] }>('admin_settings_get', me);
  const Check = ({ name, label, on }: { name: string; label: string; on: boolean }) => (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={on} className="size-5 accent-ink" />
      {label}
    </label>
  );
  return (
    <>
      <PageTitle title="Settings" sub="Prices here are in Naira. Changes reach the store within a few minutes." />
      <ActionForm action={saveSettingsAction} submitLabel="Save settings" pendingLabel="Saving…">
        <div className="space-y-4">
          <Card title="Announcement bar">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="at">
                  Text
                </label>
                <input
                  id="at"
                  name="announcement_text"
                  defaultValue={s.announcement_text ?? ''}
                  className={inputCls}
                  placeholder="Leave blank for the current national free-delivery offer"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="al">
                  Link (optional)
                </label>
                <input
                  id="al"
                  name="announcement_link"
                  defaultValue={s.announcement_link ?? ''}
                  className={inputCls}
                  placeholder="/gift-boxes"
                />
              </div>
              <div className="flex items-end">
                <Check name="announcement_active" label="Show the bar" on={s.announcement_active} />
              </div>
            </div>
          </Card>
          <Card title="Brand and contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-md bg-sand p-3 text-sm">
                {/* Kept so saving this form does not clear the old value; it is no longer shown anywhere. */}
                <input type="hidden" name="logo_url" value={s.logo_url ?? ''} />
                The logo is now changed in <Link href="/admin/website" className="font-semibold underline">Website editor → Brand &amp; SEO</Link>, with one logo for light backgrounds and one for dark.
              </div>
              <div>
                <label className={labelCls} htmlFor="wa">
                  WhatsApp number (digits, international)
                </label>
                <input
                  id="wa"
                  name="whatsapp_number"
                  defaultValue={s.whatsapp_number ?? ''}
                  placeholder="2348031234567"
                  inputMode="numeric"
                  className={inputCls}
                />
              </div>
              <div />
              <div>
                <label className={labelCls} htmlFor="ig">
                  Instagram URL
                </label>
                <input
                  id="ig"
                  name="instagram_url"
                  defaultValue={s.instagram_url ?? ''}
                  placeholder="https://instagram.com/…"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="tk">
                  TikTok URL
                </label>
                <input
                  id="tk"
                  name="tiktok_url"
                  defaultValue={s.tiktok_url ?? ''}
                  placeholder="https://tiktok.com/@…"
                  className={inputCls}
                />
              </div>
            </div>
          </Card>
          <Card title="Website content">
            <a href="/admin/website" className="font-semibold underline">
              Open the website editor →
            </a>
            <p className="mt-2 text-sm text-muted">
              Manage your homepage, pages, navigation, collection images and search descriptions.
            </p>
          </Card>
          <Card title="Nationwide delivery">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="origin">
                  Dispatch origin
                </label>
                <input
                  id="origin"
                  name="dispatch_origin"
                  defaultValue={s.dispatch_origin ?? 'Akure, Ondo State, Nigeria'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="threshold">
                  Free-delivery threshold (₦)
                </label>
                <input
                  id="threshold"
                  name="free_shipping_threshold"
                  defaultValue={n(s.free_shipping_threshold_kobo ?? 20000000)}
                  required
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">
              Counted after merchandise discounts, before shipping and extras. Verify every existing rate before
              enabling checkout for that service.
            </p>
          </Card>
          <Card title="Add-ons and fees (₦)">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelCls} htmlFor="gw">
                  Gift wrap and card
                </label>
                <input
                  id="gw"
                  name="gift_wrap"
                  defaultValue={n(s.gift_wrap_kobo)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="sn">
                  Surprise delivery note (Lagos)
                </label>
                <input
                  id="sn"
                  name="surprise_note"
                  defaultValue={n(s.surprise_note_kobo)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="ex">
                  Express 48-hour production
                </label>
                <input
                  id="ex"
                  name="express"
                  defaultValue={n(s.express_kobo)}
                  inputMode="decimal"
                  className={inputCls}
                />
                <div className="mt-1">
                  <Check name="express_enabled" label="Offer express" on={s.express_enabled} />
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="rf">
                  Extra design revision
                </label>
                <input
                  id="rf"
                  name="revision_fee"
                  defaultValue={n(s.revision_fee_kobo)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rc">
                  Store credit for a photo review
                </label>
                <input
                  id="rc"
                  name="review_credit"
                  defaultValue={n(s.review_credit_kobo)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
            </div>
          </Card>
          <Card title="Bag offer (upsell)">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="up">
                  Product offered in the bag
                </label>
                <select id="up" name="upsell_product_id" defaultValue={s.upsell_product_id ?? ''} className={inputCls}>
                  <option value="">No offer</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="upp">
                  Special price (₦)
                </label>
                <input
                  id="upp"
                  name="upsell_price"
                  defaultValue={n(s.upsell_price_kobo)}
                  inputMode="decimal"
                  className={inputCls}
                />
              </div>
            </div>
          </Card>
          <Card title="Store status">
            <Check
              name="maintenance_mode"
              label='Maintenance mode: shows a "back soon" page to shoppers and stops new orders. The admin stays available.'
              on={s.maintenance_mode}
            />
            <p className="mt-2 text-sm text-muted">
              Pay on delivery is not offered at launch
              {s.pay_on_delivery_enabled ? ' (a flag is set but not wired to checkout yet)' : ''}.
            </p>
          </Card>
        </div>
      </ActionForm>

      <CryptoSettings settings={s} />

      <h2 className="display mb-3 mt-10 text-3xl">Nationwide delivery services</h2>
      <p className="mb-5 text-sm text-muted">
        Create state or city services, confirm carrier prices, and set verified estimates. Unverified or inactive rates
        cannot be charged. Existing paid orders retain their shipping charge.
      </p>
      <div className="space-y-5">
        {zones.map((z) => (
          <ShippingZoneForm key={z.id} zone={z} />
        ))}
        <ShippingZoneForm />
      </div>
    </>
  );
}
