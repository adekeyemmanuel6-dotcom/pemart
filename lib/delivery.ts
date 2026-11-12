import type { DeliveryZone } from '@/lib/catalogue/types';

/** The zone that serves a state. Never substitutes an unrelated zone. */
export function zoneForState(zones: DeliveryZone[], state: string): DeliveryZone | undefined {
  return zones.find((z) => z.states.includes(state) && z.is_active !== false && z.rate_verified === true);
}

/** Promised date = start + lead days (calendar days). The clock starts at payment, or proof approval for custom orders. */
export function promisedDate(start: Date, leadDays: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + leadDays);
  return d;
}

export const formatDeliveryDate = (d: Date) =>
  new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }).format(d);

export const ALL_STATES = (zones: DeliveryZone[]) => zones.flatMap((z) => z.states).sort((a, b) => a.localeCompare(b));
