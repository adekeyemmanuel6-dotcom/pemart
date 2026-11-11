import Link from 'next/link';
import type { StoreSettings } from '@/lib/settings';

export function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  if (!settings.announcement_active || !settings.announcement_text) return null;
  const text = <span className="font-semibold">{settings.announcement_text}</span>;
  return (
    <div className="bg-ember px-4 py-2 text-center text-sm text-ink" role="region" aria-label="Announcement">
      {settings.announcement_link ? (
        <Link href={settings.announcement_link} className="underline-offset-4 hover:underline">{text}</Link>
      ) : text}
    </div>
  );
}
