'use server';
import { NIGERIAN_STATES } from '@/lib/shipping';
import { WORD_THEMES, BRAND_COLLECTIONS } from '@/lib/brand';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { adm, refreshStorefront, requireAdmin, requirePerm } from './db';
import { bool, int, kobo, lagosDt, list, optStr, run, str } from './actions-core';
import type { AdminResult } from './types';

const uuid = z.uuid();
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lower-case letters, numbers and dashes only')
  .max(80);
const PRODUCT_TYPES = [
  'tee',
  'hoodie',
  'frame',
  'perfume',
  'jewellery',
  'bracelet',
  'glasses',
  'fun',
  'gift_card',
] as const;
const done = (message: string): AdminResult => ({ ok: true, message });
const CAT = ['/admin/catalogue', '/admin'];

// ------------------------------------------------------------ catalogue
export async function saveCollectionAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  return run(CAT, async () => {
    const id = optStr(fd, 'id');
    await adm('admin_save', me, {
      table: 'collections',
      row: {
        ...(id ? { id } : {}),
        slug: slug.parse(str(fd, 'slug')),
        name: z.string().min(2).max(60).parse(str(fd, 'name')),
        intro: optStr(fd, 'intro'),
        hero_image: optStr(fd, 'hero_image'),
        sort_order: int(fd, 'sort_order') ?? 0,
        is_active: bool(fd, 'is_active'),
        is_seasonal: bool(fd, 'is_seasonal'),
      },
    });
    refreshStorefront();
    return done('Collection saved.');
  });
}

export async function saveDesignAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  return run(CAT, async () => {
    const id = optStr(fd, 'id');
    await adm('admin_save', me, {
      table: 'designs',
      row: {
        ...(id ? { id } : {}),
        slug: slug.parse(str(fd, 'slug')),
        name: z.string().min(2).max(80).parse(str(fd, 'name')),
        story_or_verse: optStr(fd, 'story_or_verse'),
        verse_reference: optStr(fd, 'verse_reference'),
        collection_id: optStr(fd, 'collection_id'),
        artwork_front: optStr(fd, 'artwork_front'),
        artwork_back: optStr(fd, 'artwork_back'),
        preview_image: optStr(fd, 'preview_image'),
        is_customisable: bool(fd, 'is_customisable'),
        customisable_fields: list(fd, 'customisable_fields').filter((f) => ['name', 'date', 'verse'].includes(f)),
        is_active: bool(fd, 'is_active'),
      },
    });
    refreshStorefront();
    return done('Design saved.');
  });
}

export async function saveProductAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  const id = optStr(fd, 'id');
  let go: string | null = null;
  const r = await run(CAT, async () => {
    const price = kobo(fd, 'price');
    if (price === null) throw new Error('Enter a price');
    const saved = await adm<{ id: string }>('admin_save', me, {
      table: 'products',
      row: {
        ...(id ? { id } : {}),
        slug: slug.parse(str(fd, 'slug')),
        name: z.string().min(2).max(100).parse(str(fd, 'name')),
        type: z.enum(PRODUCT_TYPES).parse(str(fd, 'type')),
        design_id: optStr(fd, 'design_id'),
        collection_id: optStr(fd, 'collection_id'),
        themes: list(fd, 'themes').filter((t) => (WORD_THEMES as readonly string[]).includes(t)),
        brand_collections: list(fd, 'brand_collections').filter((c) => BRAND_COLLECTIONS.some((b) => b.slug === c)),
        weight_grams: z.number().int().positive().nullable().parse(int(fd, 'weight_grams')),
        description: optStr(fd, 'description'),
        care: optStr(fd, 'care'),
        base_price_kobo: price,
        compare_at_kobo: kobo(fd, 'compare_at'),
        is_made_to_order: bool(fd, 'is_made_to_order'),
        // Status (draft / active / archived, migration 0021); is_active is sent too so visibility also works before 0021.
        ...(fd.has('status')
          ? { status: z.enum(['draft', 'active', 'archived']).parse(str(fd, 'status')), is_active: str(fd, 'status') === 'active' }
          : { is_active: bool(fd, 'is_active') }),
        is_featured: bool(fd, 'is_featured'),
        is_seasonal: bool(fd, 'is_seasonal'),
        seo_title: optStr(fd, 'seo_title'),
        seo_description: optStr(fd, 'seo_description'),
      },
    });
    refreshStorefront();
    if (!id) go = `/admin/catalogue/products/${saved.id}`;
    return done('Product saved.');
  });
  if (go && r?.ok) redirect(go);
  return r;
}

export async function saveVariantAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  return run(CAT.concat('/admin/catalogue/products/' + str(fd, 'productId')), async () => {
    await adm('admin_save', me, {
      table: 'product_variants',
      row: { id: uuid.parse(str(fd, 'id')), price_kobo: kobo(fd, 'price'), is_active: bool(fd, 'is_active') },
    });
    refreshStorefront();
    return done('Variant saved.');
  });
}

export async function generateVariantsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  return run('/admin/catalogue/products/' + str(fd, 'productId'), async () => {
    const stock = str(fd, 'stock_qty');
    if (!list(fd, 'colours').length && !list(fd, 'sizes').length && !list(fd, 'options').length)
      return { ok: false, message: 'Enter at least one colour, size or option first.' };
    const r = await adm<{ created: number }>('admin_variants_generate', me, {
      product_id: uuid.parse(str(fd, 'productId')),
      colours: list(fd, 'colours'),
      sizes: list(fd, 'sizes'),
      options: list(fd, 'options'),
      stock_qty: stock === '' ? null : Number(stock),
    });
    refreshStorefront();
    return done(
      r.created
        ? `Created ${r.created} new ${r.created === 1 ? 'variant' : 'variants'}. Existing ones were left alone.`
        : 'Nothing new to create: all those combinations already exist.',
    );
  });
}

export async function adjustStockAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  return run(['/admin/catalogue/products/' + str(fd, 'productId'), '/admin'], async () => {
    const r = await adm<{ ok: boolean; error?: string; stock_qty?: number }>('admin_inventory_adjust', me, {
      variant_id: uuid.parse(str(fd, 'variantId')),
      delta: int(fd, 'delta') ?? 0,
      reason: str(fd, 'reason'),
    });
    const m: Record<string, string> = {
      reason_required: 'Please give a reason (it goes in the stock log).',
      zero: 'Enter how many to add (or a negative number to remove).',
      below_zero: 'That would take stock below zero.',
      made_to_order: 'This item is made to order, so it has no stock count.',
    };
    if (!r.ok) return { ok: false, message: m[r.error ?? ''] ?? 'Could not adjust stock.' };
    refreshStorefront();
    return done(`Stock is now ${r.stock_qty}.`);
  });
}

export async function saveImagesAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  return run('/admin/catalogue/products/' + str(fd, 'productId'), async () => {
    const images = z
      .array(
        z.object({
          id: z.uuid().optional(),
          url: z.string().min(1).max(500),
          alt: z.string().max(200),
          view: z.enum(['front', 'back', 'model', 'detail']),
        }),
      )
      .max(20)
      .parse(JSON.parse(str(fd, 'images') || '[]'));
    if (images.some((i) => !i.alt.trim()))
      return { ok: false, message: 'Every image needs alt text (a short description for screen readers).' };
    await adm('admin_images_save', me, { product_id: uuid.parse(str(fd, 'productId')), images });
    refreshStorefront();
    return done('Images saved in this order.');
  });
}

const slotSchema = z.object({
  label: z.string().min(1).max(60),
  product_type: z.enum(PRODUCT_TYPES),
  allowed_collection_id: z.string().nullable().optional(),
  allowed_product_id: z.string().nullable().optional(),
  option_group: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(10),
  requires_size: z.boolean(),
  requires_colour: z.boolean(),
  requires_option: z.boolean(),
  option_label: z.string().nullable().optional(),
  requires_custom_text: z.boolean(),
  matching_group: z.string().nullable().optional(),
});

export async function saveBundleAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('catalogue');
  const id = optStr(fd, 'id');
  let go: string | null = null;
  const r = await run(CAT, async () => {
    const price = kobo(fd, 'price');
    if (price === null) throw new Error('Enter the bundle price');
    const slots = z
      .array(slotSchema)
      .max(12)
      .parse(JSON.parse(str(fd, 'slots') || '[]'))
      .map((s) => ({
        ...s,
        allowed_collection_id: s.allowed_collection_id || null,
        allowed_product_id: s.allowed_product_id || null,
        option_group: s.option_group || null,
        option_label: s.option_label || null,
        matching_group: s.matching_group || null,
      }));
    if (slots.length === 0) return { ok: false, message: 'Add at least one item to the bundle.' };
    const saved = await adm<{ id: string }>('admin_bundle_save', me, {
      bundle: {
        ...(id ? { id } : {}),
        slug: slug.parse(str(fd, 'slug')),
        name: z.string().min(2).max(80).parse(str(fd, 'name')),
        kind: z.enum(['combo', 'couple', 'gift_box']).parse(str(fd, 'kind')),
        description: optStr(fd, 'description'),
        price_kobo: price,
        available_from: lagosDt(fd, 'available_from'),
        available_until: lagosDt(fd, 'available_until'),
        image: optStr(fd, 'image'),
        badge: optStr(fd, 'badge'),
        sort_order: int(fd, 'sort_order') ?? 0,
        is_active: bool(fd, 'is_active'),
      },
      slots,
    });
    refreshStorefront();
    if (!id) go = `/admin/catalogue/bundles/${saved.id}`;
    return done('Bundle saved.');
  });
  if (go && r?.ok) redirect(go);
  return r;
}

// ------------------------------------------------------------ discounts and ambassadors
export async function saveDiscountAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('marketing');
  return run('/admin/discounts', async () => {
    const type = z.enum(['percentage', 'fixed']).parse(str(fd, 'type'));
    const value = type === 'percentage' ? int(fd, 'value') : kobo(fd, 'value');
    if (!value || value <= 0) return { ok: false, message: 'Enter the discount amount.' };
    if (type === 'percentage' && value > 100)
      return { ok: false, message: 'A percentage discount cannot be more than 100.' };
    const id = optStr(fd, 'id');
    await adm('admin_save', me, {
      table: 'discount_codes',
      row: {
        ...(id
          ? { id }
          : {
              code: z
                .string()
                .regex(/^[A-Za-z0-9]{3,24}$/, 'Codes are 3 to 24 letters or numbers')
                .transform((s) => s.toUpperCase())
                .parse(str(fd, 'code')),
            }),
        type,
        value,
        min_spend_kobo: kobo(fd, 'min_spend') ?? 0,
        starts_at: lagosDt(fd, 'starts_at'),
        ends_at: lagosDt(fd, 'ends_at', true),
        usage_limit: int(fd, 'usage_limit'),
        per_customer_limit: int(fd, 'per_customer_limit'),
        collection_ids: fd
          .getAll('collection_ids')
          .map(String)
          .filter((x) => uuid.safeParse(x).success),
        product_ids: [],
        is_active: bool(fd, 'is_active'),
      },
    });
    return done('Code saved.');
  });
}

export async function createAmbassadorAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('marketing');
  return run('/admin/discounts', async () => {
    const r = await adm<{ ok: boolean; error?: string; code?: string }>('admin_ambassador_create', me, {
      name: z.string().min(2).max(80).parse(str(fd, 'name')),
      code: str(fd, 'code'),
      phone: optStr(fd, 'phone'),
      email: optStr(fd, 'email'),
      commission_rate: 0.1,
      payout_note: optStr(fd, 'payout_note'),
    });
    if (!r.ok)
      return {
        ok: false,
        message:
          r.error === 'code_taken' ? 'That code is already used.' : 'Choose a code of at least 4 letters or numbers.',
      };
    return done(`Ambassador created. Their code is ${r.code}: buyers get 10% off and they earn 10%.`);
  });
}

export async function toggleAmbassadorAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requirePerm('marketing');
  return run('/admin/discounts', async () => {
    await adm('admin_save', me, {
      table: 'ambassadors',
      row: { id: uuid.parse(str(fd, 'id')), is_active: bool(fd, 'is_active'), payout_note: optStr(fd, 'payout_note') },
    });
    return done('Saved.');
  });
}

export async function payCommissionAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin();
  return run('/admin/discounts', async () => {
    const r = await adm<{ paid_kobo: number }>('admin_commissions_pay', me, {
      ambassador_id: uuid.parse(str(fd, 'ambassadorId')),
    });
    return r.paid_kobo > 0
      ? done(
          `Marked ${(r.paid_kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })} as paid. Make the transfer yourself and keep your own record.`,
        )
      : { ok: false, message: 'Nothing is owed right now.' };
  });
}

// ------------------------------------------------------------ settings and delivery zones
export async function saveSettingsAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin();
  return run(['/admin/settings', '/'], async () => {
    const wa = str(fd, 'whatsapp_number').replace(/\D/g, '');
    if (wa && (wa.length < 10 || wa.length > 15))
      return {
        ok: false,
        message: 'WhatsApp number: use the international format with digits only, like 2348031234567.',
      };
    const url = (k: string) => {
      const v = optStr(fd, k);
      if (v && !/^https?:\/\//.test(v)) throw new Error(`${k.replace(/_/g, ' ')} must start with https://`);
      return v;
    };
    await adm('admin_settings_save', me, {
      settings: {
        free_shipping_threshold_kobo: kobo(fd, 'free_shipping_threshold') ?? 20_000_000,
        dispatch_origin: str(fd, 'dispatch_origin') || 'Akure, Ondo State, Nigeria',
        announcement_text: optStr(fd, 'announcement_text'),
        announcement_link: optStr(fd, 'announcement_link'),
        announcement_active: bool(fd, 'announcement_active'),
        logo_url: optStr(fd, 'logo_url'),
        upsell_product_id: optStr(fd, 'upsell_product_id'),
        upsell_price_kobo: kobo(fd, 'upsell_price'),
        gift_wrap_kobo: kobo(fd, 'gift_wrap') ?? 0,
        surprise_note_kobo: kobo(fd, 'surprise_note') ?? 0,
        express_kobo: kobo(fd, 'express') ?? 0,
        express_enabled: bool(fd, 'express_enabled'),
        revision_fee_kobo: kobo(fd, 'revision_fee') ?? 0,
        review_credit_kobo: kobo(fd, 'review_credit') ?? 0,
        whatsapp_number: wa || null,
        instagram_url: url('instagram_url'),
        tiktok_url: url('tiktok_url'),
        maintenance_mode: bool(fd, 'maintenance_mode'),
      },
    });
    refreshStorefront();
    return done('Settings saved. The store updates within a few minutes.');
  });
}

export async function saveZoneAction(_p: AdminResult, fd: FormData): Promise<AdminResult> {
  const me = await requireAdmin();
  return run('/admin/settings', async () => {
    const id = optStr(fd, 'id');
    const states = list(fd, 'states');
    if (!states.length || states.some((s) => !(NIGERIAN_STATES as readonly string[]).includes(s)))
      throw new Error('Choose valid Nigerian states, using FCT for Abuja.');
    const min = z.number().int().nonnegative().nullable().parse(int(fd, 'min_days'));
    const max = z.number().int().nonnegative().nullable().parse(int(fd, 'max_days'));
    if ((min === null) !== (max === null) || (min !== null && max !== null && min > max))
      throw new Error('Enter both estimate limits in increasing order, or leave both blank.');
    const fee = kobo(fd, 'fee');
    if (fee === null) throw new Error('Enter a verified fee, including 0 for a free service.');
    await adm('admin_save', me, {
      table: 'delivery_zones',
      row: {
        ...(id ? { id: uuid.parse(id) } : {}),
        name: z.string().min(2).max(100).parse(str(fd, 'name')),
        states,
        cities: list(fd, 'cities'),
        provider: optStr(fd, 'provider'),
        service: optStr(fd, 'service'),
        fee_kobo: fee,
        is_active: bool(fd, 'is_active'),
        rate_verified: bool(fd, 'rate_verified'),
        free_shipping_eligible: bool(fd, 'free_shipping_eligible'),
        min_days: min,
        max_days: max,
        lead_days: max ?? 0,
        weight_allowance_grams: z.number().int().positive().nullable().parse(int(fd, 'weight_allowance_grams')),
        additional_kg_kobo: kobo(fd, 'additional_kg'),
        sort_order: z
          .number()
          .int()
          .nonnegative()
          .parse(int(fd, 'sort_order') ?? 0),
      },
    });
    refreshStorefront();
    return done('Zone saved.');
  });
}
