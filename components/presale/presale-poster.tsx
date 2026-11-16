import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { isLightColour, presaleImages, type PresaleConfig } from '@/lib/presale/schema';
import { toTitleCase } from '@/lib/presale/title-case';
import { PresaleCarousel } from './presale-carousel';

const fmt = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(`${iso}T12:00:00+01:00`));

/**
 * The poster half of the pre-sale: the owner's background (colour, fade and/or picture), the headline, the picture
 * carousel, offers and dates. Text colour follows the background so it always stays readable. Pure markup (the carousel
 * is its own small client component) so it can sit on the /presale page and inside the overlay.
 */
export function PresalePoster({ config, headingId }: { config: PresaleConfig; headingId?: string }) {
  const light = isLightColour(config.bgColor);
  const tone = light ? 'light' : 'dark';
  const ink = light ? 'text-[#111111]' : 'text-white';
  const soft = light ? 'text-[#111111]/75' : 'text-white/80';
  const rule = light ? 'border-[#111111]/30' : 'border-white/40';
  const style: CSSProperties = { background: config.bgColor2 ? `linear-gradient(to bottom, ${config.bgColor}, ${config.bgColor2})` : config.bgColor };
  const images = presaleImages(config);
  return (
    <div className={`relative isolate h-full overflow-hidden px-6 py-10 text-center sm:px-10 ${ink}`} style={style}>
      {config.bgImageUrl && (
        <>
          <Image src={config.bgImageUrl} alt="" fill sizes="(min-width:1024px) 45vw, 100vw" className="-z-20 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10" style={{ background: config.bgColor, opacity: 0.6 }} />
        </>
      )}
      {config.kicker && <p className={`font-script text-2xl ${soft}`}>{toTitleCase(config.kicker)}</p>}
      <h1 id={headingId} className="display text-[clamp(3.25rem,12vw,7rem)] normal-case! leading-none">{toTitleCase(config.headline)}</h1>
      {config.subhead && <p className={`mx-auto mt-4 max-w-md text-base sm:text-lg ${soft}`}>{config.subhead}</p>}

      <PresaleCarousel images={images} tone={tone} />

      {config.offers.length > 0 && (
        <ul className="mx-auto mt-8 grid max-w-md gap-4 text-left sm:grid-cols-2" aria-label="Pre-sale offers">
          {config.offers.map((o) => (
            <li key={o.text} className={`border-l-2 pl-3 ${rule}`}>
              <p className={`text-lg ${soft}`}>{toTitleCase(o.text)}</p>
              {o.price && <p className="display text-3xl normal-case!">{o.price}</p>}
            </li>
          ))}
        </ul>
      )}

      {(config.startsOn || config.endsOn) && (
        <p className={`mt-8 text-sm font-semibold ${soft}`}>
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
