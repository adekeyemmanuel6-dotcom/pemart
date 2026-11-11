import { safeFlashLink } from '@/lib/admin/flash';

export function Flash({ sp }: { sp: { flash?: string; flashLink?: string; flashLabel?: string } }) {
  if (!sp.flash) return null;
  return (
    <p role="status" aria-live="polite" className="mb-4 rounded-lg border border-mocha bg-mocha/15 p-3 text-sm font-semibold">
      {sp.flash.slice(0, 300)}{safeFlashLink(sp.flashLink) && <> <a href={sp.flashLink} target="_blank" rel="noopener noreferrer" className="underline">{(sp.flashLabel ?? 'Open').slice(0, 60)}</a></>}
    </p>
  );
}
