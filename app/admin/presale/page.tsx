import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { AdminUploader } from '@/components/admin/admin-uploader';
import { PresaleImages } from '@/components/admin/presale-images';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { Card, DataTable, Empty, PageTitle, fmtDate, inputCls, labelCls } from '@/components/admin/ui';
import { adm, isMissingFunction, requirePerm } from '@/lib/admin/db';
import { savePresaleSettingsAction, updatePresaleAction } from '@/lib/admin/actions-presale';
import { getRpc } from '@/lib/db';
import { GARMENTS, GARMENT_LABEL, SIZES, STATUSES, describeItems, presaleState, resolvePresale, type Garment, type PresaleConfig, type PresaleItem } from '@/lib/presale/schema';

export const metadata: Metadata = { title: 'Pre-sale' };
type Req = {
  id: string; reference: string; created_at: string; name: string; email: string; phone: string; state: string; city: string; address: string | null;
  items: PresaleItem[]; total_qty: number; notes: string | null; whatsapp_updates: boolean; status: (typeof STATUSES)[number]; admin_note: string | null;
};
type Listing = { requests: Req[]; counts: Record<string, number>; totals: { garment: Garment; size: string; qty: number }[] };
const STATUS_LABEL = { new: 'New', contacted: 'Contacted', confirmed: 'Confirmed', cancelled: 'Cancelled' } as const;
const waLink = (phone: string, name: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${name.split(' ')[0]}, this is about your pre-order.`)}`;

export default async function PresalePage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const sp = await searchParams;
  const me = await requirePerm('orders', '/admin/presale');
  const owner = me.role === 'admin';
  const tab = sp.tab === 'settings' && owner ? 'settings' : 'requests';
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '') ? sp.status : undefined;

  let data: Listing | null = null;
  try { data = await adm<Listing>('admin_presale_list', me, { status }); } catch (e) { if (!isMissingFunction(e)) throw e; }
  if (!data) return (<><PageTitle title="Pre-sale" /><NeedsMigration migration="0023_presale.sql" what="Pre-sale requests" /></>);

  const rpc = await getRpc();
  const cfgRaw = await rpc?.<Record<string, unknown>>('presale_config_get', {});
  const config = resolvePresale(cfgRaw?.data);
  const state = presaleState(config);

  const tabs = [['requests', 'Requests'], ...(owner ? [['settings', 'Page settings']] : [])] as const;
  const cell = (g: Garment, s: string) => data!.totals.find((t) => t.garment === g && t.size === s)?.qty ?? 0;
  const garmentTotal = (g: Garment) => data!.totals.filter((t) => t.garment === g).reduce((n, t) => n + t.qty, 0);
  const grand = data.totals.reduce((n, t) => n + t.qty, 0);

  return (
    <>
      <PageTitle title="Pre-sale" sub={state === 'open' ? 'The pre-sale is open to visitors.' : state === 'soon' ? 'Scheduled: not open yet.' : state === 'ended' ? 'The date window has ended.' : 'Switched off: visitors cannot see it.'}
        actions={<><Link href="/presale" target="_blank" className="inline-flex min-h-11 items-center rounded-btn border-2 border-ink px-4 text-sm font-semibold">View page</Link>
          <a href="/admin/presale/export" className="inline-flex min-h-11 items-center rounded-btn bg-ink px-4 text-sm font-semibold text-paper">Download CSV</a></>} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Pre-sale sections">
        {tabs.map(([k, label]) => (<Link key={k} href={`?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-btn border-2 px-4 text-sm font-semibold ${tab === k ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'}`}>{label}</Link>))}
      </nav>

      {tab === 'requests' && (<>
        <Card title="What to make (excluding cancelled)">
          {grand === 0 ? <p className="text-sm text-muted">No pieces requested yet.</p> : (
            <DataTable caption="Pieces requested by garment and size" head={['Garment', ...SIZES, 'Total']}>
              {GARMENTS.filter((g) => garmentTotal(g) > 0).map((g) => (
                <tr key={g}><th scope="row" className="px-3 py-2.5 text-left font-semibold">{config.garmentLabels[g] || GARMENT_LABEL[g]}</th>{SIZES.map((s) => (<td key={s} className="px-3 py-2.5">{cell(g, s) || '·'}</td>))}<td className="px-3 py-2.5 font-bold">{garmentTotal(g)}</td></tr>
              ))}
              <tr className="bg-sand/40"><th scope="row" className="px-3 py-2.5 text-left">All garments</th>{SIZES.map((s) => (<td key={s} className="px-3 py-2.5 font-semibold">{GARMENTS.reduce((n, g) => n + cell(g, s), 0) || '·'}</td>))}<td className="px-3 py-2.5 font-bold">{grand}</td></tr>
            </DataTable>
          )}
        </Card>

        <nav className="mb-3 mt-5 flex flex-wrap gap-2" aria-label="Filter by status">
          <Link href="?tab=requests" aria-current={!status ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${!status ? 'border-ink bg-ink text-paper' : 'border-line'}`}>All ({Object.values(data.counts).reduce((a, b) => a + b, 0)})</Link>
          {STATUSES.map((s) => (<Link key={s} href={`?tab=requests&status=${s}`} aria-current={status === s ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${status === s ? 'border-ink bg-ink text-paper' : 'border-line'}`}>{STATUS_LABEL[s]} ({data!.counts[s] ?? 0})</Link>))}
        </nav>

        {data.requests.length === 0 ? <Empty>No pre-orders {status ? `with status "${STATUS_LABEL[status as keyof typeof STATUS_LABEL]}"` : 'yet'}.</Empty> : (
          <ul className="space-y-3">
            {data.requests.map((r) => (
              <li key={r.id}><Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-lg font-bold">{r.reference} · {r.name}</p><p className="text-sm text-muted">{fmtDate(r.created_at, true)} · {r.total_qty} {r.total_qty === 1 ? 'piece' : 'pieces'}</p></div>
                <p className="mt-1 text-sm"><a href={waLink(r.phone, r.name)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">WhatsApp {r.phone}</a> · <a href={`mailto:${r.email}`} className="underline">{r.email}</a>{!r.whatsapp_updates && <span className="text-muted"> · prefers no WhatsApp updates</span>}</p>
                <p className="text-sm text-muted">{r.city}, {r.state}{r.address ? ` · ${r.address}` : ''}</p>
                <ul className="mt-2 space-y-0.5 text-sm">{describeItems(r.items, { ...GARMENT_LABEL, ...config.garmentLabels }).map((l) => (<li key={l}>{l}</li>))}</ul>
                {r.notes && <p className="mt-2 whitespace-pre-wrap rounded bg-sand/50 p-2 text-sm">{r.notes}</p>}
                <ActionForm action={updatePresaleAction} submitLabel="Save" variant="secondary" className="mt-3"><input type="hidden" name="id" value={r.id} />
                  <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                    <div><label className={labelCls} htmlFor={`st-${r.id}`}>Status</label><select id={`st-${r.id}`} name="status" defaultValue={r.status} className={inputCls}>{STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}</select></div>
                    <div><label className={labelCls} htmlFor={`nt-${r.id}`}>Team note (private)</label><input id={`nt-${r.id}`} name="admin_note" defaultValue={r.admin_note ?? ''} className={inputCls} /></div>
                  </div>
                </ActionForm>
              </Card></li>
            ))}
          </ul>
        )}
      </>)}

      {tab === 'settings' && <SettingsForm c={config} />}
    </>
  );
}

function SettingsForm({ c }: { c: PresaleConfig }) {
  const Check = ({ name, label, on }: { name: string; label: string; on: boolean }) => (<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={on} className="size-5 accent-ink" />{label}</label>);
  const T = ({ id, label, name, v, wide, help }: { id: string; label: string; name: string; v: string; wide?: boolean; help?: string }) => (<div className={wide ? 'sm:col-span-2' : ''}><label className={labelCls} htmlFor={id}>{label}</label><input id={id} name={name} defaultValue={v} className={inputCls} />{help && <p className="mt-1 text-xs text-muted">{help}</p>}</div>);
  const images = c.images.length ? c.images : c.imageUrl ? [{ url: c.imageUrl, alt: c.imageAlt }] : [];
  const offers = [...c.offers, { text: '', price: '' }, { text: '', price: '' }, { text: '', price: '' }, { text: '', price: '' }].slice(0, 4);
  return (
    <ActionForm action={savePresaleSettingsAction} submitLabel="Save pre-sale settings" pendingLabel="Saving…">
      <div className="space-y-4">
        <Card title="Switch">
          <Check name="enabled" label="Pre-sale is on (visitors can see and use it, within the dates below)" on={c.enabled} />
          <Check name="showBar" label="Show the “Pre-order now” strip at the top of every page" on={c.showBar} />
          <div className="mt-2 grid gap-3 sm:grid-cols-2"><div><label className={labelCls} htmlFor="ps-start">Opens on (optional)</label><input id="ps-start" name="startsOn" type="date" defaultValue={c.startsOn} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="ps-end">Closes after (optional)</label><input id="ps-end" name="endsOn" type="date" defaultValue={c.endsOn} className={inputCls} /></div></div>
          <p className="mt-1 text-xs text-muted">Dates are Nigerian (Lagos) calendar days. Leave both empty to run until you switch it off.</p>
        </Card>
        <Card title="Poster">
          <div className="grid gap-3 sm:grid-cols-2">
            <T id="ps-kicker" label="Small line above the headline" name="kicker" v={c.kicker} help="Shown in Title Case." />
            <T id="ps-head" label="Big headline (e.g. Big Sale)" name="headline" v={c.headline} help="Shown in Title Case." />
            <T id="ps-sub" label="Text under the headline" name="subhead" v={c.subhead} wide />
            <T id="ps-bar" label="Text on the top strip" name="barText" v={c.barText} wide />
            <div className="sm:col-span-2"><PresaleImages initial={images} /></div>
            <div><label className={labelCls} htmlFor="ps-secs">Seconds per picture (0 = no auto-play)</label><input id="ps-secs" name="carouselSeconds" type="number" min={0} max={30} defaultValue={c.carouselSeconds} className={inputCls} /><p className="mt-1 text-xs text-muted">Pictures change by themselves. Visitors can pause, and it stops while they hover or touch it.</p></div>
          </div>
        </Card>
        <Card title="Background">
          <p className="mb-2 text-sm text-muted">The poster behind the headline. Text turns dark or light by itself so it stays readable. Brand colours: black #111111, gold #C5A15D, charcoal #292929, white #FFFFFF.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls} htmlFor="ps-bg1">Background colour</label><input id="ps-bg1" name="bgColor" type="color" defaultValue={c.bgColor} className={`${inputCls} p-1`} /></div>
            <div><label className={labelCls} htmlFor="ps-bg2">Fade into a second colour (optional)</label>
              <div className="flex items-center gap-3"><input id="ps-bg2" name="bgColor2" type="color" defaultValue={c.bgColor2 || '#292929'} className={`${inputCls} p-1`} /><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="bgGradient" defaultChecked={!!c.bgColor2} className="size-5 accent-ink" />Use it</label></div></div>
            <div className="sm:col-span-2"><AdminUploader bucket="catalogue" name="bgImageUrl" label="Background picture or pattern (optional, laid under your colour)" accept=".png,.jpg,.jpeg,.webp" initial={c.bgImageUrl} /></div>
          </div>
        </Card>
        <Card title="Offers shown on the poster (optional)">
          <div className="grid gap-3 sm:grid-cols-2">{offers.map((o, i) => (<div key={i} className="grid grid-cols-[1fr_8rem] gap-2"><T id={`ps-o${i}t`} label={`Offer ${i + 1} text`} name={`offer${i + 1}_text`} v={o.text} /><T id={`ps-o${i}p`} label="Price" name={`offer${i + 1}_price`} v={o.price} /></div>))}</div>
          <p className="mt-1 text-xs text-muted">Example: “Any two tees” with price “₦30,000”. These are shown on the poster only; the form takes no payment.</p>
        </Card>
        <Card title="What people can pre-order">
          <div className="flex flex-wrap gap-x-6">{GARMENTS.map((g) => (<Check key={g} name={`garment_${g}`} label={`Offer ${GARMENT_LABEL[g]}`} on={c.garments.includes(g)} />))}</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">{GARMENTS.map((g) => (<T key={g} id={`ps-l-${g}`} label={`Name shown for ${GARMENT_LABEL[g]}`} name={`label_${g}`} v={c.garmentLabels[g]} />))}</div>
        </Card>
        <Card title="Email the customer receives">
          <p className="mb-2 text-sm text-muted">Sent the moment they submit. It always includes their name, reference, what they ordered and where it goes. The message you wrote under "Words" (after they send) is also at the top of it.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <T id="ps-es" label="Subject line" name="emailSubject" v={c.emailSubject} wide help="{reference} becomes their reference, for example PRE-1001." />
            <T id="ps-ei" label="Extra paragraph near the top (optional)" name="emailIntro" v={c.emailIntro} wide />
            <T id="ps-ef" label="Sign-off at the bottom (optional)" name="emailFooter" v={c.emailFooter} wide />
          </div>
        </Card>
        <Card title="Words">
          <div className="grid gap-3 sm:grid-cols-2">
            <T id="ps-notes" label="Hint inside the notes box" name="notesHelp" v={c.notesHelp} wide />
            <T id="ps-notice" label="Payment notice (above the send button and in their email)" name="notice" v={c.notice} wide />
            <T id="ps-ok" label="Message after they send (also in their email)" name="successText" v={c.successText} wide />
            <T id="ps-closed" label="Message when pre-sale is closed" name="closedText" v={c.closedText} wide />
          </div>
        </Card>
      </div>
    </ActionForm>
  );
}
