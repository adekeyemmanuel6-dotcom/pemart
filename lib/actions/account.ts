'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { call, getOverview } from '@/lib/account/service';
import { getCatalogue } from '@/lib/catalogue/load';
import { getProfile } from '@/lib/auth';
import { normaliseNigerianPhone } from '@/lib/validators/phone';

export type AccountState = { ok: boolean; message: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

/** React 19 clears uncontrolled fields after an action, so failures echo what was typed and the form refills from it. */
const echo = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

const phone = z.string().trim().refine((v) => normaliseNigerianPhone(v) !== null, 'Enter a valid Nigerian phone number').transform((v) => normaliseNigerianPhone(v)!);
const addressSchema = z.object({
  id: z.uuid().optional(), recipient: z.string().trim().min(2, 'Enter the recipient name').max(80), phone,
  line1: z.string().trim().min(4, 'Enter the street address').max(160), area: z.string().trim().max(80).optional(), city: z.string().trim().min(2, 'Enter the city').max(80),
  state: z.string().min(2, 'Choose a state'), isDefault: z.boolean(),
});

export async function saveAddressAction(_p: AccountState, fd: FormData): Promise<AccountState> {
  const profile = await getProfile();
  if (!profile) redirect('/auth/sign-in?next=/account');
  const parsed = addressSchema.safeParse({ id: fd.get('id') || undefined, recipient: fd.get('recipient'), phone: fd.get('phone'), line1: fd.get('line1'), area: fd.get('area') || undefined, city: fd.get('city'), state: fd.get('state'), isDefault: fd.get('isDefault') === 'on' });
  if (!parsed.success) { const fieldErrors: Record<string, string> = {}; for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message; return { ok: false, message: 'Please check the highlighted fields.', fieldErrors, values: echo(fd) }; }
  const cat = await getCatalogue();
  if (!cat.zones.some((z) => z.states.includes(parsed.data.state))) return { ok: false, message: 'Please check the highlighted fields.', fieldErrors: { state: 'Choose a state from the list' }, values: echo(fd) };
  const r = await call<{ ok: boolean }>('address_save', { profile_id: profile.id, ...parsed.data, is_default: parsed.data.isDefault });
  revalidatePath('/account');
  return r?.ok ? { ok: true, message: 'Address saved.' } : { ok: false, message: 'We could not save that address.', values: echo(fd) };
}

export async function deleteAddressAction(id: string) {
  const profile = await getProfile();
  if (!profile || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await call('address_delete', { profile_id: profile.id, id });
  revalidatePath('/account');
}

export async function toggleWishlistAction(productId: string): Promise<{ ok: boolean; on?: boolean; signedIn: boolean }> {
  const profile = await getProfile();
  if (!profile) return { ok: false, signedIn: false };
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, signedIn: true };
  const r = await call<{ on: boolean }>('wishlist_toggle', { profile_id: profile.id, product_id: productId });
  revalidatePath('/account');
  return { ok: !!r, on: r?.on, signedIn: true };
}

export async function updateProfileAction(_p: AccountState, fd: FormData): Promise<AccountState> {
  const profile = await getProfile();
  if (!profile) redirect('/auth/sign-in?next=/account');
  const name = String(fd.get('full_name') ?? '').trim();
  const raw = String(fd.get('phone') ?? '').trim();
  const ph = raw ? normaliseNigerianPhone(raw) : '';
  if (raw && !ph) return { ok: false, message: 'Enter a valid Nigerian phone number.', fieldErrors: { phone: 'Enter a valid Nigerian phone number' }, values: echo(fd) };
  await call('profile_update', { profile_id: profile.id, full_name: name, phone: ph });
  revalidatePath('/account');
  return { ok: true, message: 'Saved.' };
}

export async function wishlistStatusAction(productId: string): Promise<{ signedIn: boolean; on: boolean }> {
  const profile = await getProfile();
  if (!profile) return { signedIn: false, on: false };
  const ov = await getOverview(profile.id);
  return { signedIn: true, on: !!ov?.wishlist.includes(productId) };
}
