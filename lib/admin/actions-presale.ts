'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { PresaleConfigSchema, STATUSES, GARMENTS } from '@/lib/presale/schema';
import { adm, requireAdmin, requirePerm } from './db';
import { bool, run, str } from './actions-core';
import type { AdminResult } from './types';

const ok = (message: string): AdminResult => ({ ok: true, message });
const fail = (message: string): AdminResult => ({ ok: false, message });

/** Change a request's status and the team's private note. Needs the Orders permission (checked again in the database). */
export async function updatePresaleAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('orders', '/admin/presale');
  return run('/admin/presale', async () => {
    const status = z.enum(STATUSES).safeParse(str(fd, 'status'));
    if (!status.success) return fail('Choose a status.');
    await adm('admin_presale_update', me, { id: z.uuid().parse(str(fd, 'id')), status: status.data, admin_note: str(fd, 'admin_note').slice(0, 1500) });
    return ok('Saved.');
  });
}

/** The pre-sale page settings. Owners only. */
export async function savePresaleSettingsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin('/admin/presale');
  return run(['/admin/presale', '/presale', '/'], async () => {
    const offers = [1, 2, 3, 4].map((n) => ({ text: str(fd, `offer${n}_text`), price: str(fd, `offer${n}_price`) })).filter((o) => o.text);
    let images: unknown = [];
    try { images = JSON.parse(String(fd.get('images') ?? '[]')); } catch { return fail('Could not read the pictures. Please reload the page and try again.'); }
    const raw = {
      enabled: bool(fd, 'enabled'), showBar: bool(fd, 'showBar'), barText: str(fd, 'barText'), kicker: str(fd, 'kicker'), headline: str(fd, 'headline'), subhead: str(fd, 'subhead'),
      images, carouselSeconds: Math.round(Number(str(fd, 'carouselSeconds') || 4)), imageUrl: '', imageAlt: '', bgColor: str(fd, 'bgColor') || '#111111', bgColor2: bool(fd, 'bgGradient') ? str(fd, 'bgColor2') : '', bgImageUrl: str(fd, 'bgImageUrl'), startsOn: str(fd, 'startsOn'), endsOn: str(fd, 'endsOn'), offers,
      garments: GARMENTS.filter((g) => bool(fd, `garment_${g}`)),
      garmentLabels: { tee: str(fd, 'label_tee'), sweatshirt: str(fd, 'label_sweatshirt'), hoodie: str(fd, 'label_hoodie') },
      notesHelp: str(fd, 'notesHelp'), notice: str(fd, 'notice'), successText: str(fd, 'successText'), closedText: str(fd, 'closedText'),
      emailSubject: str(fd, 'emailSubject'), emailIntro: str(fd, 'emailIntro'), emailFooter: str(fd, 'emailFooter'),
    };
    if (raw.startsOn && raw.endsOn && raw.endsOn < raw.startsOn) return fail('The end date is before the start date.');
    const parsed = PresaleConfigSchema.safeParse(raw);
    if (!parsed.success) { const i = parsed.error.issues[0]!; return fail(`${i.path.join(' > ') || 'Settings'}: ${i.message}`); }
    await adm('admin_presale_config_save', me, { config: parsed.data });
    revalidateTag('presale'); revalidatePath('/', 'layout');
    return ok(parsed.data.enabled ? 'Saved. The pre-sale is live (within its dates).' : 'Saved. The pre-sale is switched off, so visitors will not see it.');
  });
}
