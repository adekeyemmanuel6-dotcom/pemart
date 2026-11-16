'use client';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Poster picture carousel. Plays by itself every few seconds (set in the admin; 0 turns it off), loops, and always
 * has a pause button. It also stops while someone hovers, focuses or touches it, and never auto-plays for people
 * who ask their device to reduce motion. Swipe, arrows, dots and the arrow keys all work. One picture shows alone.
 */
export function PresaleCarousel({ images, tone, autoplaySeconds = 4 }: { images: { url: string; alt: string }[]; tone: 'light' | 'dark'; autoplaySeconds?: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const [paused, setPaused] = useState(false);       // the visitor pressed pause
  const [reduced, setReduced] = useState(false);
  const holding = useRef(false);                     // hover or keyboard focus inside
  const holdUntil = useRef(0);                       // after a touch, wait before moving again

  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const goTo = useCallback((i: number, smooth = true) => {
    const el = track.current; if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    setIndex(n);
  }, [images.length]);

  useEffect(() => {
    const el = track.current; if (!el) return;
    let t: number | undefined;
    const onScroll = () => { window.clearTimeout(t); t = window.setTimeout(() => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))), 60); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); window.clearTimeout(t); };
  }, []);

  const many = images.length > 1;
  const auto = many && autoplaySeconds > 0 && !reduced;
  useEffect(() => {
    if (!auto || paused) return;
    const id = window.setInterval(() => {
      if (holding.current || Date.now() < holdUntil.current || document.hidden) return;
      goTo((indexRef.current + 1) % images.length);
    }, autoplaySeconds * 1000);
    return () => window.clearInterval(id);
  }, [auto, paused, autoplaySeconds, images.length, goTo]);

  if (images.length === 0) return null;
  const btn = `absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-lg disabled:opacity-0 ${tone === 'dark' ? 'bg-white/90 text-[#111111] hover:bg-white' : 'bg-[#111111]/85 text-white hover:bg-[#111111]'}`;
  const touchHold = () => { holdUntil.current = Date.now() + 8000; };
  return (
    <section aria-roledescription="carousel" aria-label="Pre-sale pictures" className="relative mx-auto mt-8 w-full max-w-md"
      onMouseEnter={() => { holding.current = true; }} onMouseLeave={() => { holding.current = false; }}
      onFocusCapture={() => { holding.current = true; }} onBlurCapture={() => { holding.current = false; }}
      onTouchStart={touchHold} onPointerDown={touchHold}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') goTo(index + 1); if (e.key === 'ArrowLeft') goTo(index - 1); }}>
      <div ref={track} aria-live={auto && !paused ? 'off' : 'polite'} className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-lg bg-black/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" tabIndex={many ? 0 : undefined} role={many ? 'group' : undefined} aria-label={many ? 'Pictures. Swipe or use the arrow keys to see more' : undefined}>
        {images.map((im, i) => (
          <div key={im.url + i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${images.length}`} className="relative aspect-[4/5] w-full shrink-0 snap-center">
            <Image src={im.url} alt={im.alt} fill priority={i === 0} sizes="(min-width:1024px) 40vw, 90vw" className="object-cover" />
          </div>
        ))}
      </div>
      {many && (<>
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous picture" className={`${btn} left-2`}><ChevronLeft className="size-6" aria-hidden /></button>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === images.length - 1} aria-label="Next picture" className={`${btn} right-2`}><ChevronRight className="size-6" aria-hidden /></button>
        <div className="mt-3 flex items-center justify-center gap-1" role="group" aria-label="Choose a picture">
          {auto && (
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play the slideshow' : 'Pause the slideshow'} aria-pressed={paused}
              className={`mr-2 grid size-8 place-items-center rounded-full ${tone === 'dark' ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-[#111111]/15 text-[#111111] hover:bg-[#111111]/25'}`}>
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            </button>
          )}
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
