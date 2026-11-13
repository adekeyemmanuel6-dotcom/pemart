'use client';
import { DEFAULT_HERO, type HeroSettings, type HeroSlide } from '@/lib/website/schema';
import { Field, ImageField, Move, reorder } from './editor-fields';
import { inputCls } from './ui';

const btn = 'min-h-11 rounded border px-3 text-sm';
const blankSlide = (): HeroSlide => ({ desktop: '', laptop: '', phone: '', alt: '', kicker: '', title: '', ctaText: '', ctaHref: '/collections/all' });

const LAYOUTS: { id: HeroSettings['layout']; title: string; copy: string; sketch: React.ReactNode }[] = [
  {
    id: 'slider',
    title: 'Sliding banners',
    copy: 'Up to 3 full-width banners that slide. Separate images for desktop, laptop and phone.',
    sketch: (
      <div className="relative h-16 rounded bg-[#292929]">
        <span className="absolute left-1 top-1/2 size-3 -translate-y-1/2 rounded-full bg-white/80" />
        <span className="absolute right-1 top-1/2 size-3 -translate-y-1/2 rounded-full bg-white/80" />
        <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1"><i className="h-1 w-4 rounded bg-[#C5A15D]" /><i className="h-1 w-2 rounded bg-white/70" /><i className="h-1 w-2 rounded bg-white/70" /></span>
      </div>
    ),
  },
  {
    id: 'split',
    title: 'Text and image',
    copy: 'Small heading, heading and 2 buttons on the left half; a large photo on the right half.',
    sketch: (
      <div className="grid h-16 grid-cols-2 overflow-hidden rounded bg-[#F7F5F0]">
        <div className="space-y-1 p-2"><i className="block h-1 w-6 rounded bg-[#C5A15D]" /><i className="block h-2 w-12 rounded bg-[#111]" /><i className="block h-2 w-10 rounded bg-[#111]" /><span className="flex gap-1 pt-1"><i className="h-2 w-5 rounded-sm bg-[#111]" /><i className="h-2 w-5 rounded-sm border border-[#111]" /></span></div>
        <div className="bg-[#292929]" />
      </div>
    ),
  },
  {
    id: 'banner',
    title: 'Banner with centred text',
    copy: 'One full-width image with your small heading, heading and a rounded button in the middle.',
    sketch: (
      <div className="grid h-16 place-items-center rounded bg-[#111]">
        <div className="flex flex-col items-center gap-1"><i className="h-1 w-8 rounded bg-[#C5A15D]" /><i className="h-2 w-16 rounded bg-white" /><i className="h-2.5 w-8 rounded-full bg-white" /></div>
      </div>
    ),
  },
];

function DeviceImages({ value, onChange, prefix }: { value: { desktop: string; laptop: string; phone: string; alt: string }; onChange: (v: Partial<HeroSlide>) => void; prefix: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {([
        ['desktop', 'Desktop image', '1920 × 800 px (wide screens, 1280 px and up)'],
        ['laptop', 'Laptop / tablet image', '1440 × 720 px (768–1279 px). Optional: uses the desktop image'],
        ['phone', 'Phone image', '1080 × 1350 px, portrait (under 768 px). Optional: uses the laptop or desktop image'],
      ] as const).map(([key, label, hint]) => (
        <div key={key} className="rounded border border-line/70 p-3">
          <p className="text-sm font-semibold">{prefix}{label}</p>
          <p className="mb-2 text-xs text-muted">{hint}</p>
          <ImageField value={value[key]} onChange={(v) => onChange({ [key]: v })} />
        </div>
      ))}
      <div className="lg:col-span-3">
        <Field label="Image description (for screen readers)" value={value.alt} onChange={(alt) => onChange({ alt })} />
      </div>
    </div>
  );
}

/** Chooses how the homepage hero looks and holds the images for the slider and banner styles. */
export function HeroEditor({ value, onChange }: { value: HeroSettings | undefined; onChange: (h: HeroSettings) => void }) {
  const h: HeroSettings = { ...DEFAULT_HERO, ...value };
  const set = (patch: Partial<HeroSettings>) => onChange({ ...h, ...patch });
  const setSlide = (i: number, patch: Partial<HeroSlide>) => set({ slides: h.slides.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="space-y-4 rounded-md border border-line p-3">
      <fieldset>
        <legend className="font-semibold">Hero style (the first thing visitors see)</legend>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {LAYOUTS.map((l) => (
            <label key={l.id} className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 ${h.layout === l.id ? 'border-2 border-[#C5A15D]' : 'border-line'}`}>
              {l.sketch}
              <span className="flex items-start gap-2">
                <input type="radio" name="hero-layout" className="mt-1 size-5 accent-ink" checked={h.layout === l.id}
                  onChange={() => set({ layout: l.id, slides: l.id === 'slider' && h.slides.length === 0 ? [blankSlide()] : h.slides })} />
                <span><span className="font-semibold">{l.title}</span><span className="block text-sm text-muted">{l.copy}</span></span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {h.layout === 'split' && (
        <p className="text-sm text-muted">Uses the small heading, heading, text, the two buttons and the image below. A portrait or square photo works best.</p>
      )}

      {h.layout === 'banner' && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Uses the small heading, heading, text and buttons below, centred on the banner. Without an image the banner is black.</p>
          <DeviceImages prefix="Banner: " value={h.banner} onChange={(p) => set({ banner: { ...h.banner, ...p } })} />
          <label className="block text-sm font-semibold">
            <span className="mb-1 block">Darken the image so text stays readable: {h.banner.overlay}%</span>
            <input type="range" min={0} max={80} step={5} value={h.banner.overlay} className="w-full accent-ink"
              onChange={(e) => set({ banner: { ...h.banner, overlay: Number(e.target.value) } })} />
          </label>
        </div>
      )}

      {h.layout === 'slider' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Each banner needs a desktop image; laptop and phone images are optional. Text on a banner is optional. If a banner has no text, the whole banner links to its destination.
            The heading field below is used as the page title for search engines and screen readers.
          </p>
          {h.slides.map((sl, i) => (
            <fieldset key={i} className="space-y-3 rounded-lg border border-line p-3">
              <legend className="px-1 font-semibold">Banner {i + 1}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Move index={i} length={h.slides.length} onMove={(to) => set({ slides: reorder(h.slides, i, to) })} />
                <button type="button" className={`${btn} text-ember`} disabled={h.slides.length === 1}
                  onClick={() => { if (window.confirm(`Remove banner ${i + 1}?`)) set({ slides: h.slides.filter((_, j) => j !== i) }); }}>
                  Remove banner
                </button>
              </div>
              <DeviceImages prefix="" value={sl} onChange={(p) => setSlide(i, p)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Small heading on the banner (optional)" value={sl.kicker} onChange={(kicker) => setSlide(i, { kicker })} />
                <Field label="Heading on the banner (optional)" value={sl.title} onChange={(title) => setSlide(i, { title })} />
                <Field label="Button text (optional)" value={sl.ctaText} onChange={(ctaText) => setSlide(i, { ctaText })} />
                <Field label="Destination" value={sl.ctaHref} onChange={(ctaHref) => setSlide(i, { ctaHref })} />
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-end gap-4">
            <button type="button" className={`${btn} disabled:opacity-30`} disabled={h.slides.length >= 3} onClick={() => set({ slides: [...h.slides, blankSlide()] })}>
              Add banner ({h.slides.length}/3)
            </button>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-ink" checked={h.autoplay} onChange={(e) => set({ autoplay: e.target.checked })} />
              Slide automatically
            </label>
            {h.autoplay && (
              <label className="block text-sm font-semibold">
                <span className="mb-1 block">Seconds per banner</span>
                <input type="number" min={3} max={15} value={h.interval} className={inputCls + ' w-28 font-normal'}
                  onChange={(e) => set({ interval: Math.min(15, Math.max(3, Number(e.target.value) || 6)) })} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
