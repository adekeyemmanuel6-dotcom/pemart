import 'server-only';
import { publicEnv } from '@/lib/env';

/** After an action moves an item to another list, its own form is gone, so the confirmation travels in the URL instead. */
export const flashUrl = (path: string, message: string, link?: string, label?: string) => {
  const p = new URLSearchParams({ flash: message });
  if (link) p.set('flashLink', link);
  if (label) p.set('flashLabel', label);
  return `${path}?${p}`;
};

/** Only same-site links and WhatsApp links may appear in a banner (so a crafted URL cannot send an admin somewhere else). */
export const safeFlashLink = (link?: string) => !!link && (link.startsWith('https://wa.me/') || link.startsWith(publicEnv.NEXT_PUBLIC_SITE_URL) || link.startsWith('/'));
