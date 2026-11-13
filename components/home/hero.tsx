import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_HERO, bannerAlt, type WebsiteContent, type WebsiteSection } from '@/lib/website/schema';
import { ArtPicture } from './art-picture';
import { HeroSlider } from './hero-slider';
import { sectionLook } from './section-look';

const pill =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-semibold uppercase tracking-[0.14em] transition-colors duration-150';

/** Homepage hero in the style chosen in Website editor: split (text + image), sliding banners, or one banner. */
export function Hero({ section: s, brand }: { section: WebsiteSection; brand: WebsiteContent['brand'] }) {
  const hero = { ...DEFAULT_HERO, ...s.hero };
  const look = sectionLook(s);

  if (hero.layout === 'slider' && hero.slides.some((sl) => sl.desktop)) {
    const slides = hero.slides.filter((sl) => sl.desktop);
    return (
      <section className={look.className} style={look.style} aria-labelledby="hero-title">
        <h1 id="hero-title" className="sr-only">{s.title || brand.name}</h1>
        <HeroSlider
          autoplay={hero.autoplay}
          interval={hero.interval}
          labels={slides.map((sl, i) => bannerAlt(sl, `${brand.name} banner ${i + 1}`))}
          slides={slides.map((sl, i) => {
            const hasText = Boolean(sl.kicker || sl.title || sl.ctaText);
            const picture = (
              <div className="relative aspect-[4/5] md:aspect-[2/1] xl:aspect-[12/5]">
                <ArtPicture desktop={sl.desktop} laptop={sl.laptop} phone={sl.phone} alt={bannerAlt(sl, `${brand.name} banner ${i + 1}`)} priority={i === 0} />
                {hasText && <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" aria-hidden />}
                {hasText && (
                  <div className="absolute inset-x-0 bottom-16 px-6 text-white sm:px-12 xl:px-20">
                    {sl.kicker && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{sl.kicker}</p>}
                    {sl.title && <h2 className="display mt-3 max-w-3xl whitespace-pre-line text-5xl sm:text-7xl">{sl.title}</h2>}
                    {sl.ctaText && (
                      <Link href={sl.ctaHref} className={`${pill} mt-6 bg-white text-[#111] hover:bg-gold`}>
                        {sl.ctaText}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
            // A banner without its own button is still clickable when it has a destination.
            return !hasText && sl.ctaHref ? (
              <Link href={sl.ctaHref} aria-label={bannerAlt(sl, `${brand.name} banner ${i + 1}`)} className="block">{picture}</Link>
            ) : picture;
          })}
        />
      </section>
    );
  }

  if (hero.layout === 'banner') {
    const b = hero.banner;
    const hasImage = Boolean(b.desktop || b.laptop || b.phone);
    return (
      <section
        className={`${look.className} relative isolate grid min-h-[520px] place-items-center overflow-hidden bg-[#111] px-6 py-24 text-white md:min-h-[600px] xl:min-h-[680px]`}
        style={look.style}
        aria-labelledby="hero-title"
      >
        {hasImage && <ArtPicture desktop={b.desktop} laptop={b.laptop} phone={b.phone} alt={bannerAlt({ alt: b.alt, title: s.title, kicker: s.kicker }, brand.name)} priority className="absolute inset-0 -z-10 size-full object-cover" />}
        {hasImage && <div className="absolute inset-0 -z-10 bg-black" style={{ opacity: b.overlay / 100 }} aria-hidden />}
        <div className="mx-auto max-w-4xl text-center">
          {s.kicker && <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold sm:text-sm">{s.kicker}</p>}
          <h1 id="hero-title" className="display mt-5 whitespace-pre-line text-5xl sm:text-7xl xl:text-8xl">{s.title}</h1>
          {s.body && <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-base text-white/85 sm:text-lg">{s.body}</p>}
          {(s.linkText || s.secondaryText) && (
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              {s.linkText && <Link href={s.href} className={`${pill} bg-white text-[#111] hover:bg-gold`}>{s.linkText}</Link>}
              {s.secondaryText && <Link href={s.secondaryHref} className={`${pill} border border-white/80 text-white hover:border-gold hover:bg-gold hover:text-[#111]`}>{s.secondaryText}</Link>}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Split: small heading, heading, text and two buttons on the left half; a large image on the right half.
  return (
    <section className={`wtw-hero ${look.className}`} style={look.style} aria-labelledby="hero-title">
      <div className="wtw-hero-copy">
        <p className="wtw-eyebrow">
          <span className="wtw-dot" />
          {s.kicker}
        </p>
        <h1 id="hero-title" className="display whitespace-pre-line">{s.title}</h1>
        <p className="max-w-md whitespace-pre-line text-base leading-relaxed text-muted sm:text-lg">{s.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {s.linkText && (
            <Button asChild>
              <Link href={s.href}>
                {s.linkText}
                <ArrowUpRight size={18} aria-hidden />
              </Link>
            </Button>
          )}
          {s.secondaryText && (
            <Button asChild variant="secondary">
              <Link href={s.secondaryHref}>{s.secondaryText}</Link>
            </Button>
          )}
        </div>
      </div>
      <div className="wtw-hero-image">
        {s.image ? (
          <Image src={s.image} alt={s.alt || brand.name} fill sizes="(min-width:1024px) 50vw, 100vw" priority className="object-cover" />
        ) : (
          <div className="wtw-campaign-placeholder">
            <span className="wtw-eyebrow">{brand.name}</span>
            <span className="wtw-campaign-type" aria-hidden>
              THE
              <br />
              WORD.
              <br />
              <span>WORN.</span>
            </span>
            <span className="wtw-placeholder-note">Campaign photograph to be supplied</span>
          </div>
        )}
      </div>
    </section>
  );
}
