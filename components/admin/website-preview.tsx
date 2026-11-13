/* eslint-disable @next/next/no-img-element -- local content preview */
import type { CSSProperties } from 'react';
import { imageHref, type WebsiteContent } from '@/lib/website/schema';
import { PageBody, WebsitePageView } from '@/components/website-page';
function Photo({ src, alt }: { src: string; alt: string }) {
  return src && imageHref.safeParse(src).success ? (
    <img src={src} alt={alt} className="my-4 max-h-72 max-w-full object-contain" />
  ) : null;
}
export function WebsitePreview({ content, tab }: { content: WebsiteContent; tab: string }) {
  const colours =
    content.brand.palette === 'forest'
      ? { '--ink': '#132b21', '--paper': '#fafbf8', '--sand': '#e6ece4', '--muted': '#4f6658' }
      : content.brand.palette === 'earth'
        ? { '--ink': '#30251c', '--paper': '#fffdf8', '--sand': '#f0e6d7', '--muted': '#6b5b4b' }
        : { '--ink': '#111', '--paper': '#fff', '--sand': '#F4F0E8', '--muted': '#605B54' };
  const heading =
    content.brand.headingStyle === 'serif'
      ? 'Georgia, serif'
      : content.brand.headingStyle === 'sans'
        ? 'Arial, sans-serif'
        : 'var(--font-anton), Impact, sans-serif';
  return (
    <div
      className="rounded-lg border border-line bg-paper p-6 text-ink"
      style={{ ...colours, '--line': '#DCD8D0', '--font-display': heading } as CSSProperties}
    >
      <h2 className="mb-2 text-2xl font-bold">Content preview</h2>
      <p className="mb-6 text-sm">
        Unpublished content. Product grids and checkout use your catalogue and store settings.
      </p>
      {tab === 'Brand & SEO' ? (
        <>
          <h2 className="display text-5xl">{content.brand.name}</h2>
          <p className="my-3">{content.brand.byline}</p>
          <p className="my-6">{content.brand.footer}</p>
          <p className="border-t pt-4">{content.brand.copyright}</p>
          <div className="mt-6 rounded border p-4">
            <h3 className="font-bold">Search preview</h3>
            <p className="mt-3 text-xl">{content.brand.seoTitle}</p>
            <p>{content.brand.seoDescription}</p>
          </div>
          <Photo src={content.brand.ogImage} alt="Social sharing preview" />
        </>
      ) : tab === 'Mega menu' ? (
        content.megaMenu?.mode === 'custom' ? (
          <div className="space-y-6">
            {content.megaMenu.panels.map((p) => (
              <section key={p.id} className="border-t pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-widest">{p.label}<span className="ml-2 text-xs font-normal normal-case text-muted">{p.show === 'all' ? '' : p.show === 'desktop' ? 'desktop only' : 'phone only'}</span></h3>
                <div className="mt-3 grid gap-6 sm:grid-cols-4">
                  {p.columns.map((c, i) => (
                    <div key={i}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{c.heading}</p>
                      <ul className="space-y-1 text-sm">{c.links.map((l, j) => (<li key={j}>{l.name}{l.show !== 'all' && <span className="text-xs text-muted"> ({l.show})</span>}</li>))}</ul>
                    </div>
                  ))}
                  {p.feature.enabled && (
                    <div className="bg-[#111] p-4 text-white">
                      <Photo src={p.feature.image} alt={p.feature.alt} />
                      <p className="text-xs uppercase tracking-widest">{p.feature.eyebrow}</p>
                      <p className="display text-2xl">{p.feature.title}</p>
                      <p className="mt-1 text-xs underline">{p.feature.cta}</p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p>The header menu is built automatically from your live products, gift boxes and collections.</p>
        )
      ) : tab === 'Navigation' ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {Object.entries(content.navigation).map(([key, links]) => (
            <section key={key}>
              <h2 className="display mb-4 text-3xl">{key}</h2>
              {links.map((link, i) => (
                <div key={i} className="border-t py-3">
                  <p className="font-bold">{link.name}</p>
                  <p className="break-all text-sm text-muted">{link.href}</p>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : tab === 'Collections' ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {content.collections
            .filter((c) => c.enabled)
            .map((c) => (
              <section key={c.slug}>
                <Photo src={c.image} alt={c.name} />
                <h2 className="display text-3xl">{c.name}</h2>
                <p className="mt-3">{c.blurb}</p>
              </section>
            ))}
        </div>
      ) : tab === 'Community photos' ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {content.community.map((p, i) => (
            <figure key={i}>
              <Photo src={p.image} alt={p.alt} />
              <figcaption>{p.caption}</figcaption>
            </figure>
          ))}
        </div>
      ) : tab === 'Pages' ? (
        <>
          {content.pages.some((p) => p.enabled) ? (
            content.pages.filter((p) => p.enabled).map((p) => <WebsitePageView key={p.slug} page={p} />)
          ) : (
            <p>No edited pages are enabled. The original information pages will stay in place.</p>
          )}
        </>
      ) : (
        content.sections
          .filter((s) => s.enabled)
          .map((s) => (
            <section key={s.id} className="mb-8 border-t pt-6">
              <p className="text-xs uppercase">{s.kicker}</p>
              <h2 className="display my-3 whitespace-pre-line break-words text-4xl">{s.title}</h2>
              <Photo src={s.image} alt={s.alt} />
              <PageBody body={s.body} />
              {s.linkText && <p className="mt-4 font-semibold">{s.linkText} →</p>}
            </section>
          ))
      )}
    </div>
  );
}
