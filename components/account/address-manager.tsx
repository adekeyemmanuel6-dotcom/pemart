'use client';
import { useActionState, useState } from 'react';
import { deleteAddressAction, saveAddressAction, type AccountState } from '@/lib/actions/account';
import type { Address } from '@/lib/account/service';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

function AddressForm({ zones, address, onDone }: { zones: string[]; address?: Address; onDone: () => void }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(async (prev, fd) => { const r = await saveAddressAction(prev, fd); if (r?.ok) onDone(); return r; }, null);
  const e = (k: string) => state?.fieldErrors?.[k];
  const v = (k: string, fallback?: string | null) => state?.values?.[k] ?? fallback ?? '';
  const f = (k: string) => ({ 'aria-invalid': !!e(k) || undefined });
  const Err = ({ k }: { k: string }) => (e(k) ? <p role="alert" className="mt-1 text-sm text-ember">{e(k)}</p> : null);
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg border border-line bg-paper p-4 sm:grid-cols-2" noValidate>
      {address && <input type="hidden" name="id" value={address.id} />}
      <div><Label htmlFor="a-recipient">Recipient</Label><Input id="a-recipient" name="recipient" defaultValue={v('recipient', address?.recipient)} {...f('recipient')} /><Err k="recipient" /></div>
      <div><Label htmlFor="a-phone">Phone</Label><Input id="a-phone" name="phone" type="tel" defaultValue={v('phone', address?.phone)} {...f('phone')} /><Err k="phone" /></div>
      <div className="sm:col-span-2"><Label htmlFor="a-line1">Street address</Label><Input id="a-line1" name="line1" defaultValue={v('line1', address?.line1)} {...f('line1')} /><Err k="line1" /></div>
      <div><Label htmlFor="a-area">Area (optional)</Label><Input id="a-area" name="area" defaultValue={v('area', address?.area)} /></div>
      <div><Label htmlFor="a-city">City / town</Label><Input id="a-city" name="city" defaultValue={v('city', address?.city)} {...f('city')} /><Err k="city" /></div>
      <div className="sm:col-span-2"><Label htmlFor="a-state">State</Label>
        <select id="a-state" name="state" defaultValue={v('state', address?.state ?? 'Lagos')} className="min-h-12 w-full rounded-btn border border-line bg-white px-3 text-base">{zones.map((s) => (<option key={s}>{s}</option>))}</select><Err k="state" /></div>
      <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><input type="checkbox" name="isDefault" defaultChecked={address?.is_default} className="size-5 accent-ink" /><span className="text-sm font-semibold">Make this my default address</span></label>
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="text-sm text-ember sm:col-span-2">{state.message}</p>}
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save address'}</Button><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}

export function AddressManager({ addresses, states }: { addresses: Address[]; states: string[] }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  return (
    <div>
      {addresses.length === 0 && editing !== 'new' && <p className="text-muted">No saved addresses yet.</p>}
      <ul className="space-y-3">
        {addresses.map((a) => (
          <li key={a.id} className="rounded-lg border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <address className="not-italic"><strong>{a.recipient}</strong>{a.is_default && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs font-bold uppercase">Default</span>}<br /><span className="text-muted">{a.line1}{a.area ? `, ${a.area}` : ''}, {a.city}, {a.state}<br />{a.phone}</span></address>
              <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing(a.id)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => deleteAddressAction(a.id)} aria-label={`Delete address for ${a.recipient}`}>Delete</Button></div>
            </div>
            {editing === a.id && <AddressForm zones={states} address={a} onDone={() => setEditing(null)} />}
          </li>
        ))}
      </ul>
      {editing === 'new' ? <AddressForm zones={states} onDone={() => setEditing(null)} /> : <Button variant="secondary" className="mt-3" onClick={() => setEditing('new')}>Add an address</Button>}
    </div>
  );
}
