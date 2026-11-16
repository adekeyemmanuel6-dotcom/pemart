import Image from 'next/image';
import type { ReactNode } from 'react';
import type { PresaleConfig } from '@/lib/presale/schema';

const fmt = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(`${iso}T12:00:00+01:00`));

/**
 * The poster half of the pre-sale: dark studio backdrop, a softly glowing headline, the uploaded picture, offers and dates.
 * Pure markup (no client code) so it can sit on the /presale page and inside the overlay.
 */
export function PresalePoster({ config, headingId }: { config: PresaleConfig; headingId?: string }) {
  return (
    <div className="relative isolate h-full overflow-hidden bg-gradient-to-b from-[#44474d] via-[#2b2d31] to-[#1b1c1f] px-6 py-10 text-center text-white sm:px-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
      {config.kicker && <p className="font-script text-2xl text-white/80">{config.kicker}</p>}
      <h1 id={headingId} className="display text-[clamp(3.5rem,13vw,7.5rem)] leading-none [text-shadow:0_0_14px_rgba(255,255,255,0.9),0_0_44px_rgba(255,255,255,0.45)]">{config.headline}</h1>
      {config.subhead && <p className="mx-auto mt-4 max-w-md text-base text-white/85 sm:text-lg">{config.subhead}</p>}

      {config.imageUrl && (
        <div className="relative mx-auto mt-8 aspect-[4/5] w-full max-w-md overflow-hidden rounded-lg bg-black/30">
          <Image src={config.imageUrl} alt={config.imageAlt} fill priority sizes="(min-width:1024px) 40vw, 90vw" className="object-cover" />
        </div>
      )}

      {config.offers.length > 0 && (
        <ul className="mx-auto mt-8 grid max-w-md gap-4 text-left sm:grid-cols-2" aria-label="Pre-sale offers">
          {config.offers.map((o) => (
            <li key={o.text} className="border-l-2 border-white/40 pl-3">
              <p className="text-lg text-white/70">{o.text}</p>
              {o.price && <p className="display text-3xl">{o.price}</p>}
            </li>
          ))}
        </ul>
      )}

      {(config.startsOn || config.endsOn) && (
        <p className="mt-8 text-sm font-semibold text-white/85">
          {config.startsOn && <>From: {fmt(config.startsOn)}</>}{config.startsOn && config.endsOn && <span aria-hidden className="mx-3">·</span>}{config.endsOn && <>Until: {fmt(config.endsOn)}</>}
        </p>
      )}
    </div>
  );
}

/** Poster on top, form card below on phones; side by side on large screens. */
export function PresaleLayout({ poster, children }: { poster: ReactNode; children: ReactNode }) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div>{poster}</div>
      <div className="bg-paper px-5 py-10 text-ink sm:px-10 lg:min-h-screen">{children}</div>
    </div>
  );
}
