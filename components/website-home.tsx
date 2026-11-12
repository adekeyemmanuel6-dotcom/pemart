import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ProductCard } from '@/components/product/product-card';
import { BundleCard } from '@/components/product/bundle-card';
import { CollectionEditorial } from '@/components/collection-editorial';
import { NewsletterForm } from '@/components/layout/newsletter-form';
import { Button } from '@/components/ui/button';
import { PageBody } from '@/components/website-page';
import { WORD_THEMES, brandProducts } from '@/lib/brand';
import { bundleSeparateTotal, isBundleAvailable, sortCards, toCard } from '@/lib/catalogue/helpers';
import type { Catalogue } from '@/lib/catalogue/types';
import type { WebsiteContent, WebsiteSection } from '@/lib/website/schema';

function Photo({ section: s }: { section: WebsiteSection }) {
  return s.image ? (
    <div className="relative mb-8 aspect-[16/9]">
      <Image src={s.image} alt={s.alt} fill sizes="(min-width:1024px) 1100px, 100vw" className="object-cover" />
    </div>
  ) : null;
}
function Cta({ section: s, href }: { section: WebsiteSection; href?: string }) {
  return s.linkText ? (
    <Link href={href || s.href} className="wtw-text-link mt-5">
      {s.linkText}
      <ArrowUpRight size={18} aria-hidden />
    </Link>
  ) : null;
}
export function WebsiteHome({ content, cat }: { content: WebsiteContent; cat: Catalogue }) {
  const ranked = sortCards(
    cat.products.filter((p) => p.is_active).map((p) => toCard(cat, p)),
    'featured',
  );
  const featured = content.featuredProductIds.length
    ? content.featuredProductIds.flatMap((id) => {
        const p = cat.products.find((p) => p.id === id && p.is_active);
        return p ? [toCard(cat, p)] : [];
      })
    : [
        ...ranked.filter((p) => p.type === 'tee' || p.type === 'hoodie'),
        ...ranked.filter((p) => p.type !== 'tee' && p.type !== 'hoodie'),
      ].slice(0, 4);
  const gifts = cat.bundles.filter((b) => b.kind === 'gift_box' && isBundleAvailable(b)).slice(0, 6);
  const story = cat.designs.find(
    (d) => d.story_or_verse && cat.products.some((p) => p.is_active && p.design_id === d.id),
  );
  const storyProduct = story && cat.products.find((p) => p.is_active && p.design_id === story.id);
  return (
    <>
      {content.sections
        .filter((s) => s.enabled)
        .map((s) => {
          if (s.id === 'hero')
            return (
              <section key={s.id} className="wtw-hero" aria-labelledby="hero-title">
                <div className="wtw-hero-copy">
                  <p className="wtw-eyebrow">
                    <span className="wtw-dot" />
                    {s.kicker}
                  </p>
                  <h1 id="hero-title" className="display whitespace-pre-line">
                    {s.title}
                  </h1>
                  <p className="max-w-md whitespace-pre-line text-base leading-relaxed text-muted sm:text-lg">
                    {s.body}
                  </p>
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
                    <Image
                      src={s.image}
                      alt={s.alt || content.brand.name}
                      fill
                      sizes="(min-width:1024px) 55vw, 100vw"
                      priority
                      className="object-cover"
                    />
                  ) : (
                    <div className="wtw-campaign-placeholder">
                      <span className="wtw-eyebrow">{content.brand.name}</span>
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
          if (s.id === 'manifesto')
            return (
              <div key={s.id} className="wtw-manifesto-strip">
                {s.title.split('\n').map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            );
          if (s.id === 'story' && (!story || !storyProduct)) return null;
          const dark = s.id === 'philosophy' || s.id === 'bulk';
          return (
            <section
              key={s.id}
              className={
                dark ? 'wtw-philosophy' : s.id === 'together' ? 'wtw-together' : s.id === 'gifts' ? 'bg-sand' : ''
              }
              aria-labelledby={`${s.id}-title`}
            >
              <div className={`wtw-section ${s.id === 'newsletter' ? 'text-center' : ''}`}>
                <Photo section={s} />
                <div className="wtw-section-heading">
                  <div>
                    <p className="wtw-eyebrow">{s.kicker}</p>
                    <h2
                      id={`${s.id}-title`}
                      className="display mt-4 max-w-4xl whitespace-pre-line text-4xl sm:text-6xl"
                    >
                      {s.title}
                    </h2>
                  </div>
                  {['collections', 'featured', 'gifts'].includes(s.id) && <Cta section={s} />}
                </div>
                {s.id === 'collections' ? (
                  <div className="wtw-collection-grid">
                    {content.collections
                      .filter((c) => c.enabled)
                      .map((c, i) => (
                        <CollectionEditorial
                          key={c.slug}
                          collection={c}
                          index={i}
                          image={
                            c.image ||
                            cat.collections.find((r) => r.slug === c.slug)?.hero_image ||
                            brandProducts(cat, c.slug)[0]?.product_images.find(
                              (im) => !im.url.startsWith('/placeholders/'),
                            )?.url ||
                            null
                          }
                        />
                      ))}
                  </div>
                ) : s.id === 'featured' ? (
                  featured.length ? (
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
                      {featured.map((p) => (
                        <li key={p.slug}>
                          <ProductCard p={p} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{s.body}</p>
                  )
                ) : s.id === 'gifts' ? (
                  gifts.length ? (
                    <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                      {gifts.map((b) => (
                        <li key={b.id}>
                          <BundleCard
                            bundle={b}
                            separateKobo={bundleSeparateTotal(cat, b)}
                            contents={b.bundle_slots
                              .map((slot) => `${slot.quantity > 1 ? `${slot.quantity} × ` : ''}${slot.label}`)
                              .join(' · ')}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="max-w-xl text-lg">{s.body}</p>
                  )
                ) : (
                  <div
                    className={
                      dark
                        ? 'max-w-3xl whitespace-pre-line text-lg text-white/80'
                        : 'max-w-3xl whitespace-pre-line text-lg text-muted'
                    }
                  >
                    {s.body}
                  </div>
                )}
                {s.id === 'themes' && (
                  <div className="wtw-themes mt-8">
                    {WORD_THEMES.map((theme, i) => (
                      <Link
                        key={theme}
                        href={`/themes/${encodeURIComponent(theme.toLowerCase().replaceAll(' ', '-'))}`}
                      >
                        <span className="text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                        <span>{theme}</span>
                        <ArrowUpRight size={20} aria-hidden />
                      </Link>
                    ))}
                  </div>
                )}
                {s.id === 'story' && story && (
                  <div className="mt-6 max-w-2xl">
                    <h3 className="display mb-4 text-3xl">{story.name}</h3>
                    <PageBody body={story.story_or_verse || ''} />
                  </div>
                )}
                {s.id === 'community' && content.community.length > 0 && (
                  <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {content.community.map((p, i) => (
                      <li key={i}>
                        <div className="relative aspect-[4/5]">
                          <Image
                            src={p.image}
                            alt={p.alt}
                            fill
                            sizes="(min-width:768px) 25vw, 50vw"
                            className="object-cover"
                          />
                        </div>
                        <p className="mt-2 text-sm">{p.caption}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {!['collections', 'featured', 'gifts'].includes(s.id) && (
                  <Cta
                    section={s}
                    href={
                      s.id === 'story' && storyProduct && s.href === '/collections/all'
                        ? `/products/${storyProduct.slug}`
                        : undefined
                    }
                  />
                )}
                {s.id === 'newsletter' && (
                  <div className="mt-8 flex justify-center">
                    <NewsletterForm tone="light" />
                  </div>
                )}
              </div>
            </section>
          );
        })}
    </>
  );
}
