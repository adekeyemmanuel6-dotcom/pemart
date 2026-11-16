'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Poster picture carousel. Swipe or scroll on phones, arrow buttons and dots for everyone (keyboard friendly).
 * Does not move by itself, so nobody has to chase a moving picture. A single picture shows without controls.
 */
export function PresaleCarousel({ images, tone }: { images: { url: string; alt: string }[]; tone: 'light' | 'dark' }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((i: number) => {
    const el = track.current; if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setIndex(n);
  }, [images.length]);

  useEffect(() => {
    const el = track.current; if (!el) return;
    let t: number | undefined;
    const onScroll = () => { window.clearTimeout(t); t = window.setTimeout(() => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))), 60); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); window.clearTimeout(t); };
  }, []);

  if (images.length === 0) return null;
  const many = images.length > 1;
  const btn = `absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-lg disabled:opacity-0 ${tone === 'dark' ? 'bg-white/90 text-[#111111] hover:bg-white' : 'bg-[#111111]/85 text-white hover:bg-[#111111]'}`;
  return (
    <section aria-roledescription="carousel" aria-label="Pre-sale pictures" className="relative mx-auto mt-8 w-full max-w-md" onKeyDown={(e) => { if (e.key === 'ArrowRight') goTo(index + 1); if (e.key === 'ArrowLeft') goTo(index - 1); }}>
      <div ref={track} className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-lg bg-black/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" tabIndex={many ? 0 : undefined} role={many ? 'group' : undefined} aria-label={many ? 'Swipe or use the arrow keys to see more pictures' : undefined}>
        {images.map((im, i) => (
          <div key={im.url + i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${images.length}`} className="relative aspect-[4/5] w-full shrink-0 snap-center">
            <Image src={im.url} alt={im.alt} fill priority={i === 0} sizes="(min-width:1024px) 40vw, 90vw" className="object-cover" />
          </div>
        ))}
      </div>
      {many && (<>
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous picture" className={`${btn} left-2`}><ChevronLeft className="size-6" aria-hidden /></button>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === images.length - 1} aria-label="Next picture" className={`${btn} right-2`}><ChevronRight className="size-6" aria-hidden /></button>
        <div className="mt-3 flex justify-center gap-1" role="group" aria-label="Choose a picture">
          {images.map((_, i) => (
            <button key={i} type="button" onClick={() => goTo(i)} aria-label={`Show picture ${i + 1}`} aria-current={i === index ? 'true' : undefined} className="grid size-6 place-items-center">
              <span className={`block rounded-full transition-all ${i === index ? (tone === 'dark' ? 'h-2.5 w-6 bg-white' : 'h-2.5 w-6 bg-[#111111]') : (tone === 'dark' ? 'size-2.5 bg-white/45' : 'size-2.5 bg-[#111111]/35')}`} />
            </button>
          ))}
        </div>
      </>)}
    </section>
  );
}
