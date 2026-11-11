'use client';
import { COOKIE_BANNER, openConsentSettings } from '@/lib/consent';

export function CookieSettingsLink() {
  if (!COOKIE_BANNER) return null;
  return <button type="button" onClick={openConsentSettings} className="min-h-11 hover:underline">Cookie settings</button>;
}
