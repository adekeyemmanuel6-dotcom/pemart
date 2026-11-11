'use client';
import { openConsentSettings } from '@/lib/consent';

export function CookieSettingsLink() {
  return <button type="button" onClick={openConsentSettings} className="min-h-11 hover:underline">Cookie settings</button>;
}
