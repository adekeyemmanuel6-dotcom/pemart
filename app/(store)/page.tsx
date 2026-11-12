import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { BundleCard } from '@/components/product/bundle-card';
import { ProductCard } from '@/components/product/product-card';
import { NewsletterForm } from '@/components/layout/newsletter-form';
import { Button } from '@/components/ui/button';
import { bundleSeparateTotal, isBundleAvailable, sortCards, toCard } from '@/lib/catalogue/helpers';
import { getCatalogue } from '@/lib/catalogue/load';
import { getSettings } from '@/lib/settings';
import { BRAND_COLLECTIONS, WORD_THEMES, brandProducts } from '@/lib/brand';
import { UGC_PHOTOS } from '@/lib/ugc';
import { SITE } from '@/lib/site';
import { CollectionEditorial } from '@/components/collection-editorial';
export const revalidate = 300;
export const metadata: Metadata = {
  title: { absolute: `${SITE.name} | ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: '/' },
};
export default async function HomePage() {
  const [cat, settings] = await Promise.all([getCatalogue(), getSettings()]);
  const ranked = sortCards(
    cat.products.filter((p) => p.is_active).map((p) => toCard(cat, p)),
    'featured',
  );
  const featured = [
    ...ranked.filter((p) => p.type === 'tee' || p.type === 'hoodie'),
    ...ranked.filter((p) => p.type !== 'tee' && p.type !== 'hoodie'),
  ].slice(0, 4);
  const gifts = cat.bundles.filter((b) => b.kind === 'gift_box' && isBundleAvailable(b)).slice(0, 6);
  const story = cat.designs.find((d) => d.story_or_verse && cat.products.some((p) => p.design_id === d.id));
  const storyProduct = story && cat.products.find((p) => p.design_id === story.id);
  return (
    <>
      <section className="wtw-hero" aria-labelledby="hero-title">
        <div className="wtw-hero-copy">
          <p className="wtw-eyebrow">
            <span className="wtw-dot" />
            Christian lifestyle. Everyday conviction.
          </p>
          <h1 id="hero-title" className="display">
            {settings.hero_headline || 'WEAR WHAT YOU STAND ON.'}
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted sm:text-lg">{settings.hero_copy}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/collections/all">
                Shop the collection <ArrowUpRight size={18} aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/about">Discover our story</Link>
            </Button>
          </div>
          <p className="mt-12 text-[10px] font-semibold uppercase tracking-[.25em]">The Word. Worn. Lived. Shared.</p>
        </div>
        <div className="wtw-hero-image">
          {settings.hero_image_url ? (
            <Image
              src={settings.hero_image_url}
              alt={settings.hero_image_alt || 'Wear The Word campaign'}
              fill
              sizes="(min-width:1024px) 55vw, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="wtw-campaign-placeholder" role="img" aria-label="Campaign photography placeholder">
              <span className="wtw-eyebrow">Wear The Word / Campaign 01</span>
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
          <span className="wtw-image-caption">Rooted in Scripture. Made for everyday life.</span>
        </div>
      </section>
      <div className="wtw-manifesto-strip">
        <span>Believe it.</span>
        <span>Live it.</span>
        <span>Wear it.</span>
        <span>Share it.</span>
      </div>
      <section className="wtw-section" aria-labelledby="collections-title">
        <div className="wtw-section-heading">
          <div>
            <p className="wtw-eyebrow">01 / A message for every season</p>
            <h2 id="collections-title" className="display">
              Find your expression.
            </h2>
          </div>
          <Link className="wtw-text-link" href="/collections">
            All collections <ArrowUpRight size={18} aria-hidden />
          </Link>
        </div>
        <div className="wtw-collection-grid">
          {BRAND_COLLECTIONS.map((c, i) => (
            <CollectionEditorial
              key={c.slug}
              collection={c}
              index={i}
              image={
                cat.collections.find((r) => r.slug === c.slug)?.hero_image ||
                brandProducts(cat, c.slug)[0]?.product_images.find((im) => !im.url.startsWith('/placeholders/'))?.url ||
                null
              }
            />
          ))}
        </div>
      </section>
      <section className="wtw-section wtw-section-tight" aria-labelledby="featured-title">
        <div className="wtw-section-heading">
          <div>
            <p className="wtw-eyebrow">02 / The everyday rotation</p>
            <h2 id="featured-title" className="display">
              Pieces with purpose.
            </h2>
          </div>
          <Link href="/collections/all" className="wtw-text-link">
            Shop all <ArrowUpRight size={18} aria-hidden />
          </Link>
        </div>
        {featured.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {featured.map((p) => (
              <li key={p.slug}>
                <ProductCard p={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-y border-line py-8 text-muted">
            Our collection is being prepared. Explore our story while we get it ready.
          </p>
        )}
      </section>
      <section className="wtw-philosophy" aria-labelledby="philosophy-title">
        <div className="wtw-section">
          <p className="wtw-eyebrow">More than what you wear.</p>
          <h2 id="philosophy-title" className="display">
            The Word was never meant
            <br className="hidden md:block" /> to be kept on a page.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <p className="text-xl text-white/75">
              Every season has a Word. A promise to hold on to. A truth to remember. A declaration to live by.
            </p>
            <div>
              <p className="max-w-lg text-white/75">
                At Wear The Word, we turn those timeless truths into everyday expressions of faith.
              </p>
              <Link href="/about" className="wtw-text-link mt-7">
                Why we wear the Word <ArrowUpRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="wtw-section" aria-labelledby="word-title">
        <div className="wtw-section-heading">
          <div>
            <p className="wtw-eyebrow">03 / What are you standing on?</p>
            <h2 id="word-title" className="display">
              Find your Word.
            </h2>
          </div>
          <p className="max-w-sm text-muted">Start with a message that speaks to your season.</p>
        </div>
        <div className="wtw-themes">
          {WORD_THEMES.map((theme, i) => (
            <Link key={theme} href={`/themes/${encodeURIComponent(theme.toLowerCase().replaceAll(' ', '-'))}`}>
              <span className="text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
              <span>{theme}</span>
              <ArrowUpRight size={20} aria-hidden />
            </Link>
          ))}
        </div>
      </section>
      <section className="bg-sand" aria-labelledby="gifts-title">
        <div className="wtw-section">
          <div className="wtw-section-heading">
            <div>
              <p className="wtw-eyebrow">04 / Give something that means something</p>
              <h2 id="gifts-title" className="display">
                A gift. A Word. A reminder.
              </h2>
            </div>
            <Link href="/gift-boxes" className="wtw-text-link">
              Explore gift collections <ArrowUpRight size={18} aria-hidden />
            </Link>
          </div>
          {gifts.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {gifts.map((b) => (
                <li key={b.id}>
                  <BundleCard
                    bundle={b}
                    separateKobo={bundleSeparateTotal(cat, b)}
                    contents={b.bundle_slots
                      .map((s) => `${s.quantity > 1 ? `${s.quantity} × ` : ''}${s.label}`)
                      .join(' · ')}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-y border-line py-8">
              <p className="max-w-lg text-lg">
                Thoughtful gifts for couples, families, moments of encouragement and the people who help you grow.
              </p>
              <Link href="/gift-boxes" className="wtw-text-link mt-6">
                Discover available gift boxes →
              </Link>
            </div>
          )}
        </div>
      </section>
      {story && storyProduct && (
        <section className="wtw-section grid items-center gap-10 md:grid-cols-2" aria-labelledby="design-title">
          <div className="wtw-design-panel">
            <span className="wtw-eyebrow">The Word behind the design</span>
            <p className="display mt-14 text-6xl sm:text-8xl">{story.name}</p>
            <span className="mt-12 block text-xs tracking-[.2em]">WEAR THE WORD</span>
          </div>
          <div>
            <p className="wtw-eyebrow">Designed to remind you.</p>
            <h2 id="design-title" className="display mt-5 text-5xl">
              Every piece has a meaning.
            </h2>
            <p className="mt-6 max-w-lg text-lg text-muted">
              Discover the message, the inspiration and the intention behind {story.name}.
            </p>
            <Link href={`/products/${storyProduct.slug}`} className="wtw-text-link mt-8">
              Discover this design <ArrowUpRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
      )}
      <section className="wtw-together" aria-labelledby="together-title">
        <div className="wtw-section grid gap-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="wtw-eyebrow">One faith. Many stories.</p>
            <h2 id="together-title" className="display mt-6 text-6xl md:text-7xl">
              Faith is better
              <br />
              when shared.
            </h2>
          </div>
          <div className="self-end">
            <p className="mb-8 text-lg text-muted">
              His &amp; hers. Parents &amp; children. A family standing on the same Word. Choose individual sizes in our
              matching bundles.
            </p>
            <Button asChild>
              <Link href="/couples">
                Shop matching collections <ArrowUpRight size={18} aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="wtw-section" aria-labelledby="community-title">
        <div className="wtw-section-heading">
          <div>
            <p className="wtw-eyebrow">Worn. Lived. Shared.</p>
            <h2 id="community-title" className="display">
              Your faith. Your everyday.
            </h2>
          </div>
          {settings.instagram_url && (
            <a href={settings.instagram_url} className="wtw-text-link" target="_blank" rel="noopener noreferrer">
              Join us on Instagram <ArrowUpRight size={18} aria-hidden />
            </a>
          )}
        </div>
        {UGC_PHOTOS.length ? (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {UGC_PHOTOS.map((u) => (
              <li key={u.src} className="relative aspect-[4/5]">
                <Image src={u.src} alt={u.alt} fill sizes="25vw" className="object-cover" />
                <span className="absolute bottom-2 left-2 bg-ink p-2 text-xs text-white">{u.handle}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-xl text-lg text-muted">
            We would love to see how you wear your Word. Share your story with our team. Customer photographs appear
            here with permission.
          </p>
        )}
      </section>
      <section className="wtw-section wtw-section-tight" aria-labelledby="bulk-title">
        <div className="wtw-bulk">
          <div>
            <p className="wtw-eyebrow">Made for your people</p>
            <h2 id="bulk-title" className="display mt-5 text-4xl sm:text-6xl">
              Your church. Your community.
              <br />
              One message.
            </h2>
            <p className="mt-5 max-w-lg text-white/75">
              Meaningful apparel for churches, ministries, conferences, schools and groups. Tell us your idea and
              quantity for a tailored quote.
            </p>
          </div>
          <Button asChild className="bg-white text-ink hover:bg-sand">
            <Link href="/bulk">
              Request a bulk quote <ArrowUpRight size={18} aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
      <section className="wtw-section text-center" aria-labelledby="newsletter-title">
        <p className="wtw-eyebrow">A little inspiration for your everyday walk</p>
        <h2 id="newsletter-title" className="display mt-6 text-5xl sm:text-7xl">
          Stay rooted in the Word.
        </h2>
        <p className="mx-auto mt-5 mb-8 max-w-xl text-muted">
          New collections, meaningful messages and exclusive releases.
        </p>
        <div className="flex justify-center">
          <NewsletterForm tone="light" />
        </div>
      </section>
    </>
  );
}
