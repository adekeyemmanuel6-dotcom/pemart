import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { ProductCard } from '@/components/product/product-card';
import { sortCards, toCard } from '@/lib/catalogue/helpers';
import type { Catalogue } from '@/lib/catalogue/types';
import type { WebsiteSection } from '@/lib/website/schema';
import { sectionLook } from './section-look';

const pill = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 text-sm font-semibold uppercase tracking-[0.14em] transition-colors duration-150';

function Cta({ s, className = 'wtw-text-link mt-5' }: { s: WebsiteSection; className?: string }) {
  return s.linkText ? (
    <Link href={s.href} className={className}>
      {s.linkText}
      <ArrowUpRight size={18} aria-hidden />
    </Link>
  ) : null;
}

/** A homepage section added from a template in the Website editor. */
export function CustomSection({ section: s, cat }: { section: WebsiteSection; cat: Catalogue }) {
  const look = sectionLook(s);
  const titleId = `${s.id}-title`;
  const Heading = ({ className = 'display mt-4 max-w-4xl whitespace-pre-line text-4xl sm:text-6xl' }: { className?: string }) =>
    s.title ? <h2 id={titleId} className={className}>{s.title}</h2> : null;
  const Kicker = () => (s.kicker ? <p className="wtw-eyebrow">{s.kicker}</p> : null);
  const center = look.align === 'center';

  if (s.template === 'banner') {
    return (
      <section aria-labelledby={titleId} className={`${look.className} relative isolate grid min-h-[440px] place-items-center overflow-hidden bg-[#111] px-6 py-20 text-white md:min-h-[520px]`} style={look.style}>
        {s.image && <Image src={s.image} alt={s.alt} fill sizes="100vw" className="-z-10 object-cover" />}
        {s.image && <div className="absolute inset-0 -z-10 bg-black/50" aria-hidden />}
        <div className="mx-auto max-w-3xl text-center">
          {s.kicker && <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">{s.kicker}</p>}
          <Heading className="display mt-4 whitespace-pre-line text-5xl sm:text-7xl" />
          {s.body && <p className="mx-auto mt-5 max-w-xl whitespace-pre-line text-white/85">{s.body}</p>}
          {s.linkText && <Link href={s.href} className={`${pill} mt-8 bg-white text-[#111] hover:bg-gold`}>{s.linkText}</Link>}
        </div>
      </section>
    );
  }

  if (s.template === 'cta') {
    return (
      <section aria-labelledby={titleId} className={look.className} style={look.style}>
        <div className={`wtw-section flex flex-col gap-6 ${center ? 'items-center text-center' : 'md:flex-row md:items-center md:justify-between'}`}>
          <div className={center ? 'max-w-3xl' : 'max-w-2xl'}>
            <Kicker />
            <Heading className="display mt-2 whitespace-pre-line text-4xl sm:text-5xl" />
            {s.body && <p className="ws-body mt-3 whitespace-pre-line text-lg text-muted">{s.body}</p>}
          </div>
          {s.linkText && <Link href={s.href} className={`${pill} shrink-0 bg-ink text-paper hover:bg-gold hover:text-[#111]`}>{s.linkText}</Link>}
        </div>
      </section>
    );
  }

  if (s.template === 'quote') {
    return (
      <section aria-labelledby={titleId} className={look.className} style={look.style}>
        <figure className={`wtw-section ${center ? 'text-center' : ''}`}>
          <Kicker />
          <blockquote><p id={titleId} className={`display mt-4 whitespace-pre-line text-4xl sm:text-6xl ${center ? 'mx-auto max-w-4xl' : 'max-w-4xl'}`}>{s.title}</p></blockquote>
          {s.body && <figcaption className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-muted">{s.body}</figcaption>}
          <Cta s={s} />
        </figure>
      </section>
    );
  }

  if (s.template === 'image_text') {
    const imageRight = s.imageSide === 'right';
    return (
      <section aria-labelledby={titleId} className={look.className} style={look.style}>
        <div className="wtw-section grid items-center gap-10 md:grid-cols-2">
          <div className={`relative aspect-[4/5] overflow-hidden bg-sand ${imageRight ? 'md:order-2' : ''}`}>
            {s.image ? <Image src={s.image} alt={s.alt} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" /> : <div className="grid h-full place-items-center text-sm text-muted">Photograph to be supplied</div>}
          </div>
          <div className={center ? 'text-center' : ''}>
            <Kicker />
            <Heading className="display mt-4 whitespace-pre-line text-4xl sm:text-6xl" />
            {s.body && <p className="ws-body mt-5 max-w-xl whitespace-pre-line text-lg text-muted">{s.body}</p>}
            <Cta s={s} />
          </div>
        </div>
      </section>
    );
  }

  if (s.template === 'faq') {
    return (
      <section aria-labelledby={titleId} className={look.className} style={look.style}>
        <div className="wtw-section">
          <div className={`mb-8 ${center ? 'text-center' : ''}`}><Kicker /><Heading /></div>
          <div className={`divide-y divide-line border-y border-line ${center ? 'mx-auto max-w-3xl' : 'max-w-3xl'}`}>
            {(s.items ?? []).map((q, i) => (
              <details key={i} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-semibold">
                  {q.title}<ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <p className="pb-5 whitespace-pre-line text-muted">{q.body}</p>
              </details>
            ))}
          </div>
          <div className={center ? 'text-center' : ''}><Cta s={s} /></div>
        </div>
      </section>
    );
  }

  if (s.template === 'products') {
    const coll = s.collection ? cat.collections.find((c) => c.slug === s.collection) : null;
    const active = cat.products.filter((p) => p.is_active && p.type !== 'gift_card' && (!s.collection || p.collection_id === coll?.id || (p.brand_collections ?? []).includes(s.collection)));
    const cards = (s.collection ? sortCards(active.map((p) => toCard(cat, p)), 'featured')
      : [...active].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p) => toCard(cat, p))).slice(0, s.limit ?? 4);
    if (cards.length === 0) return null;
    return (
      <section aria-labelledby={titleId} className={look.className} style={look.style}>
        <div className="wtw-section">
          <div className="wtw-section-heading"><div><Kicker /><Heading /></div><Cta s={s} /></div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {cards.map((p) => (<li key={p.slug}><ProductCard p={p} /></li>))}
          </ul>
        </div>
      </section>
    );
  }

  // text
  return (
    <section aria-labelledby={titleId} className={look.className} style={look.style}>
      <div className="wtw-section">
        <div className="wtw-section-heading"><div><Kicker /><Heading /></div></div>
        {s.body && <p className="ws-body max-w-3xl whitespace-pre-line text-lg text-muted">{s.body}</p>}
        <Cta s={s} />
      </div>
    </section>
  );
}
