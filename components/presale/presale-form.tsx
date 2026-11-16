'use client';
import { Minus, Plus } from 'lucide-react';
import { useActionState, useMemo, useState } from 'react';
import { submitPresale, type PresaleState } from '@/lib/actions/presale';
import { MAX_PER_SIZE, SIZES, SIZE_LABEL, cleanItems, itemQty, totalQty, type Garment, type PresaleItem, type Size } from '@/lib/presale/schema';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export type FormGarment = { id: Garment; label: string };
type Qty = Record<Garment, Partial<Record<Size, number>>>;

const field = 'mt-1';
const Err = ({ id, msg }: { id: string; msg?: string }) => (msg ? <p id={id} role="alert" className="mt-1 text-sm text-ember">{msg}</p> : null);

/** The pre-order form: pick garments, enter a quantity for each size, say where it goes. Used on /presale and in the overlay. */
export function PresaleForm({ garments, states, notesHelp, notice, onDone }: { garments: FormGarment[]; states: string[]; notesHelp: string; notice: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState<PresaleState, FormData>(submitPresale, null);
  const [picked, setPicked] = useState<Garment[]>([]);
  const [qty, setQty] = useState<Qty>({ tee: {}, sweatshirt: {}, hoodie: {} });
  const v = state?.values ?? {};
  const fe = state?.fieldErrors ?? {};

  const items: PresaleItem[] = useMemo(() => cleanItems(picked.map((g) => ({ garment: g, sizes: qty[g] }))), [picked, qty]);
  const total = totalQty(items);
  const set = (g: Garment, s: Size, n: number) => setQty((q) => ({ ...q, [g]: { ...q[g], [s]: Math.max(0, Math.min(MAX_PER_SIZE, Number.isFinite(n) ? Math.round(n) : 0)) } }));
  const toggle = (g: Garment) => setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  if (state?.ok) {
    return (
      <div role="status" className="space-y-4 text-center">
        <p className="font-script text-3xl text-mocha">thank you</p>
        <h2 className="display text-4xl">{state.demo ? 'Demo only' : 'Request received'}</h2>
        <p className="text-lg">{state.message}</p>
        {state.reference && <p className="rounded-lg border-2 border-dashed border-ink py-3 text-2xl font-bold tracking-widest">{state.reference}</p>}
        {state.lines && (<ul className="mx-auto max-w-sm space-y-1 text-left">{state.lines.map((l) => (<li key={l} className="rounded border border-line bg-sand/50 px-3 py-2 text-sm">{l}</li>))}</ul>)}
        <p className="text-sm text-muted">Keep your reference. We have also emailed you a copy.</p>
        {onDone && <Button onClick={onDone} className="w-full sm:w-auto">Done</Button>}
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-8" aria-label="Pre-order form">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <fieldset>
        <legend className="display mb-1 text-3xl">1. What would you like?</legend>
        <p className="mb-3 text-sm text-muted">Pick one or more, then enter how many you want in each size.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Garments">
          {garments.map((g) => {
            const on = picked.includes(g.id);
            return (
              <button key={g.id} type="button" aria-pressed={on} onClick={() => toggle(g.id)}
                className={`min-h-12 rounded-btn border-2 px-5 text-base font-semibold transition-colors ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-white hover:border-ink'}`}>
                {g.label}
              </button>
            );
          })}
        </div>
        <Err id="items-err" msg={fe.items} />

        <div className="mt-4 space-y-4">
          {garments.filter((g) => picked.includes(g.id)).map((g) => {
            const q = itemQty({ garment: g.id, sizes: qty[g.id] });
            return (
              <section key={g.id} aria-label={`${g.label} sizes`} className="rounded-lg border border-line bg-sand/40 p-4">
                <div className="mb-3 flex items-baseline justify-between"><h3 className="text-lg font-bold">{g.label}</h3><p className="text-sm text-muted">{q} {q === 1 ? 'piece' : 'pieces'}</p></div>
                <ul className="grid grid-cols-5 gap-2">
                  {SIZES.map((s) => {
                    const n = qty[g.id][s] ?? 0;
                    return (
                      <li key={s} className="text-center">
                        <label htmlFor={`q-${g.id}-${s}`} className="block text-sm font-bold" title={SIZE_LABEL[s]}>{s}</label>
                        <div className="mt-1 flex flex-col items-center gap-1">
                          <button type="button" onClick={() => set(g.id, s, n + 1)} aria-label={`Add one ${g.label} size ${SIZE_LABEL[s]}`} className="grid size-11 place-items-center rounded-btn border border-line bg-white hover:bg-sand"><Plus className="size-4" aria-hidden /></button>
                          <input id={`q-${g.id}-${s}`} inputMode="numeric" value={n} aria-label={`${g.label} size ${SIZE_LABEL[s]} quantity`} onChange={(e) => set(g.id, s, parseInt(e.target.value, 10))}
                            className="h-11 w-full min-w-0 rounded-btn border border-line bg-white text-center text-base font-semibold" />
                          <button type="button" onClick={() => set(g.id, s, n - 1)} disabled={n === 0} aria-label={`Remove one ${g.label} size ${SIZE_LABEL[s]}`} className="grid size-11 place-items-center rounded-btn border border-line bg-white hover:bg-sand disabled:opacity-40"><Minus className="size-4" aria-hidden /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="mt-3 font-semibold" aria-live="polite">{total === 0 ? 'No pieces chosen yet.' : `Total: ${total} ${total === 1 ? 'piece' : 'pieces'}`}</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="display mb-1 text-3xl">2. Your details</legend>
        <div><Label htmlFor="pr-name">Full name</Label><Input id="pr-name" name="name" defaultValue={v.name} autoComplete="name" aria-invalid={!!fe.name} aria-describedby="pr-name-e" className={field} /><Err id="pr-name-e" msg={fe.name} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="pr-phone">WhatsApp number</Label><Input id="pr-phone" name="phone" type="tel" defaultValue={v.phone} autoComplete="tel" placeholder="0803 123 4567" aria-invalid={!!fe.phone} aria-describedby="pr-phone-e" className={field} /><Err id="pr-phone-e" msg={fe.phone} /></div>
          <div><Label htmlFor="pr-email">Email</Label><Input id="pr-email" name="email" type="email" defaultValue={v.email} autoComplete="email" aria-invalid={!!fe.email} aria-describedby="pr-email-e" className={field} /><Err id="pr-email-e" msg={fe.email} /></div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="display mb-1 text-3xl">3. Where should we send it?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="pr-state">State</Label>
            {/* key: React resets a select after a failed submit and ignores a changed defaultValue, so remount it with the echoed value */}
            <select key={v.state ?? 'new'} id="pr-state" name="state" defaultValue={v.state ?? ''} aria-invalid={!!fe.state} aria-describedby="pr-state-e" className="mt-1 min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base">
              <option value="" disabled>Choose your state</option>
              {states.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <Err id="pr-state-e" msg={fe.state} />
          </div>
          <div><Label htmlFor="pr-city">City or town</Label><Input id="pr-city" name="city" defaultValue={v.city} autoComplete="address-level2" aria-invalid={!!fe.city} aria-describedby="pr-city-e" className={field} /><Err id="pr-city-e" msg={fe.city} /></div>
        </div>
        <div><Label htmlFor="pr-address">Street address or landmark (optional)</Label><Input id="pr-address" name="address" defaultValue={v.address} autoComplete="street-address" className={field} /></div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="display mb-1 text-3xl">4. Anything else?</legend>
        <div><Label htmlFor="pr-notes">Notes (optional)</Label><textarea id="pr-notes" name="notes" rows={4} maxLength={1500} defaultValue={v.notes} placeholder={notesHelp} className="mt-1 w-full rounded-btn border border-line bg-white px-3 py-2 text-base" /></div>
        <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" name="whatsappUpdates" defaultChecked={state ? v.whatsappUpdates === 'on' : true} className="size-5 accent-ink" />Send me updates about my pre-order on WhatsApp</label>
      </fieldset>

      {notice && <p className="rounded-lg bg-sand/70 p-3 text-sm">{notice}</p>}
      {state && !state.ok && <p role="alert" className="rounded-btn border border-ember/40 bg-ember/10 p-3 text-sm">{state.message}</p>}
      <Button type="submit" className="w-full text-lg" disabled={pending}>{pending ? 'Sending…' : total > 0 ? `Pre-order ${total} ${total === 1 ? 'piece' : 'pieces'}` : 'Send pre-order'}</Button>
    </form>
  );
}
