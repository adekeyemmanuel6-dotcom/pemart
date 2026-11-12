import Link from 'next/link';
import { formatNaira } from '@/lib/money';
import type { StoreSettings } from '@/lib/settings';

export function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  if (!settings.announcement_active) return null;
  const text = <span className="font-semibold">{settings.announcement_text || `Free nationwide delivery on eligible orders from ${formatNaira(settings.free_shipping_threshold_kobo)}`}</span>;
  return (
    <div className="bg-ink px-4 py-2 text-center text-[10px] uppercase tracking-widest text-white" role="region" aria-label="Announcement">
      {settings.announcement_link ? (
        <Link href={settings.announcement_link} className="underline-offset-4 hover:underline">{text}</Link>
      ) : text}
    </div>
  );
}
