/** Order status machine. Mirrors public._order_transition_ok() in SQL (a test compares every pair). */
export const ORDER_STATUSES = [
  'pending_payment', 'paid', 'awaiting_proof', 'proof_sent', 'revision_requested', 'approved', 'in_production', 'quality_check',
  'packed', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'reprint',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const LIVE: OrderStatus[] = ['paid', 'awaiting_proof', 'proof_sent', 'revision_requested', 'approved', 'in_production', 'quality_check', 'packed', 'reprint'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  switch (to) {
    case 'cancelled': return LIVE.includes(from);
    case 'refunded': return from !== 'pending_payment' && from !== 'refunded';
    case 'in_production': return from === 'paid' || from === 'approved' || from === 'reprint';
    case 'quality_check': return from === 'in_production';
    case 'reprint': return from === 'quality_check';
    case 'packed': return from === 'quality_check';
    case 'out_for_delivery': return from === 'packed';
    case 'delivered': return from === 'out_for_delivery';
    default: return false;
  }
}

/** Where an order can go next from the production board (Phase 6) and which of those notify the customer. */
export const nextStatuses = (from: OrderStatus) => ORDER_STATUSES.filter((s) => canTransition(from, s));
export const NOTIFY_ON: OrderStatus[] = ['in_production', 'out_for_delivery', 'delivered'];

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Waiting for payment', paid: 'Payment confirmed', awaiting_proof: 'Preparing your design proof', proof_sent: 'Proof ready for you',
  revision_requested: 'Revision requested', approved: 'Design approved', in_production: 'In production', quality_check: 'Quality check', packed: 'Packed',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded', reprint: 'Reprinting',
};
