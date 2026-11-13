'use client';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Accessible banner slider: arrows, dots, swipe, keyboard (← →), autoplay that pauses on hover, on keyboard
 * focus and when the tab is hidden, a visible pause button, and no autoplay for people who prefer reduced motion.
 * Slides are rendered on the server and passed in, so images stay optimised and work without JavaScript.
 */
export function HeroSlider({
  slides,
  labels,
  autoplay,
  interval,
}: {
  slides: ReactNode[];
  labels: string[];
  autoplay: boolean;
  interval: number;
}) {
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const startX = useRef<number | null>(null);

  const go = useCallback((to: number) => setIndex(((to % n) + n) % n), [n]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!playing || hovered || focused || reduced || n < 2) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % n);
    }, interval * 1000);
    return () => window.clearInterval(t);
  }, [playing, hovered, focused, reduced, n, interval]);

  if (n === 0) return null;
  const arrow =
    'absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#111] shadow-sm transition-colors duration-150 hover:bg-gold focus-visible:bg-gold';

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      className="relative overflow-hidden bg-[#111]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(index - 1);
        if (e.key === 'ArrowRight') go(index + 1);
      }}
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
        aria-live={playing && !reduced ? 'off' : 'polite'}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}: ${labels[i] ?? ''}`}
            aria-hidden={i !== index}
            inert={i !== index}
            className="relative w-full shrink-0"
          >
            {slide}
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" className={`${arrow} left-3 sm:left-6`} aria-label="Previous banner" onClick={() => go(index - 1)}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" className={`${arrow} right-3 sm:right-6`} aria-label="Next banner" onClick={() => go(index + 1)}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1">
            {autoplay && !reduced && (
              <button
                type="button"
                className="grid size-11 place-items-center text-white hover:text-gold"
                aria-label={playing ? 'Pause the slider' : 'Play the slider'}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              </button>
            )}
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className="grid size-11 place-items-center"
                aria-label={`Show banner ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <span className={`block h-1.5 rounded-full transition-all duration-200 ${i === index ? 'w-8 bg-gold' : 'w-3 bg-white/70'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
