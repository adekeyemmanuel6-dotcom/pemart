/**
 * One JSON line per payment or webhook event, so they can be searched in Vercel logs.
 * NEVER pass card details or secrets here (we do not receive card data at all).
 */
export function logEvent(event: string, data: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ t: new Date().toISOString(), event, ...data }));
}
