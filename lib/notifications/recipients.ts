/**
 * Who gets the team's notifications (new pre-orders, bulk quotes, revision requests). ADMIN_NOTIFY_EMAIL can hold
 * several addresses separated by commas, semicolons or spaces. Invalid entries are ignored; duplicates are removed.
 */
export function parseRecipients(raw: string | undefined | null): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? '').split(/[,;\s]+/)) {
    const e = part.trim().toLowerCase();
    if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e)) seen.add(e);
  }
  return [...seen];
}
export const adminRecipients = () => parseRecipients(process.env.ADMIN_NOTIFY_EMAIL);
