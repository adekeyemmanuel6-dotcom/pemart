import type { BundleSelection } from '@/lib/bundles/selection';
import type { ProductType } from '@/lib/catalogue/types';

export type CartLineInput =
  | { id: string; kind: 'variant'; refId: string; quantity: number; upsell?: boolean; giftCard?: { recipientEmail?: string; message?: string } }
  | { id: string; kind: 'bundle'; refId: string; quantity: number; selection: BundleSelection }
  | { id: string; kind: 'custom'; refId: string; quantity: number };

export type Extras = { giftWrap?: boolean; surpriseNote?: boolean; express?: boolean; shipReadyFirst?: boolean };

export type PricingInput = {
  lines: CartLineInput[];
  code?: string;
  giftCode?: string;
  useCredit?: boolean;
  state?: string;
  extras?: Extras;
  acceptFinalSale?: boolean;
  giftMessage?: string;
};

/** What the database tells us (discount, gift card, credit, custom briefs). Never supplied by the browser. */
export type DbContext = {
  discount?: {
    id: string; code: string; type: 'percentage' | 'fixed'; value: number; min_spend_kobo: number;
    starts_at: string | null; ends_at: string | null; usage_limit: number | null; times_used: number;
    per_customer_limit: number | null; customer_uses: number; collection_ids: string[]; product_ids: string[];
    ambassador_id: string | null; ambassador_rate: number | null;
  };
  gift_card?: { id: string; code: string; balance_kobo: number; expires_at: string | null };
  credit_kobo?: number;
  customRequests?: { id: string; tier: 'personalise' | 'text_design' | 'full_custom'; product_type: 'tee' | 'hoodie' | 'frame'; colour: string | null; status: string; in_use: boolean; text_fields: Record<string, unknown>; design_id: string | null }[];
};

export type PricingSettings = {
  giftWrapKobo: number; surpriseNoteKobo: number; expressKobo: number; expressEnabled: boolean;
  upsellProductId: string | null; upsellPriceKobo: number | null;
};

export type QuoteLine = {
  id: string; kind: 'variant' | 'bundle' | 'custom' | 'gift_card';
  name: string; detail: string[]; contents: string[];
  quantity: number; unitKobo: number; lineKobo: number;
  visual: { type: ProductType | 'bundle'; designSlug: string | null; colour: string | null; finish: string | null; imageUrl: string | null };
  issues: string[]; upsell: boolean; giftMessage?: string; giftWrap?: boolean; slug?: string;
};

export type DbItem = {
  kind: 'variant' | 'bundle' | 'gift_card' | 'custom'; variant_id?: string; bundle_id?: string; name: string;
  options: Record<string, unknown>; selections?: unknown; unit_price: number; quantity: number; custom_request_id?: string; gift_message?: string;
};

export type Quote = {
  ok: boolean;                       // true when nothing blocks placing the order
  issues: string[];                  // blocking problems (order-level)
  warnings: string[];                // non-blocking (e.g. Christmas lateness)
  lines: QuoteLine[];
  subtotalKobo: number;
  discount: { code: string; amountKobo: number; ambassador: boolean } | null;
  codeError?: string;
  giftCodeError?: string;
  zone: { id: string; name: string; feeKobo: number; freeOverKobo: number | null; leadDays: number } | null;
  deliveryFeeKobo: number;
  freeDeliveryAwayKobo: number | null;   // how far the goods are from free delivery in Lagos (null once reached / n/a)
  freeDeliveryThresholdKobo: number | null;
  upsell: { productName: string; offerKobo: number; regularKobo: number; variants: { id: string; option: string }[] } | null;
  giftWrapKobo: number; surpriseNoteKobo: number; expressKobo: number; shipReadyFirstKobo: number;
  giftCardAppliedKobo: number; creditAppliedKobo: number; creditAvailableKobo: number;
  totalKobo: number;
  hasCustom: boolean; hasBundle: boolean; digitalOnly: boolean; needsFinalSaleConsent: boolean;
  promise: { readyBy: string | null; customBy: string | null; leadDays: number; proofHours: number | null; express: boolean };
  // Used to create the order; never sent to the browser.
  reservations: { variantId: string; qty: number }[];
  dbItems: DbItem[];
  discountId: string | null; ambassadorCode: string | null; giftCardId: string | null;
};

/** The quote as the browser sees it: no stock holds, no database ids for codes. */
export type PublicQuote = Omit<Quote, 'reservations' | 'dbItems' | 'discountId' | 'ambassadorCode' | 'giftCardId'>;
