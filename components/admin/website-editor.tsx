'use client';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { publishWebsite } from '@/lib/admin/actions-website';
import { EXISTING_PAGES, type WebsiteContent } from '@/lib/website/schema';
import { WebsitePreview } from './website-preview';
import { AdminUploader } from './admin-uploader';
import { inputCls } from './ui';

const tabs = ['Brand & SEO', 'Homepage', 'Navigation', 'Collections', 'Community photos', 'Pages'] as const;
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
}) {
  const id = useId();
  const displayLabel =
    (
      {
        title: 'Heading',
        body: 'Supporting text',
        secondaryText: 'Second button label',
        secondaryHref: 'Second button destination',
        intro: 'Introduction',
        kicker: 'Small heading',
        name: 'Display name',
        blurb: 'Description',
      } as Record<string, string>
    )[label] || label;
  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={id} className="mb-1 block">
        {displayLabel}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={label === 'Page content' ? 14 : 4}
          className={inputCls + ' py-2 font-normal'}
        />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls + ' font-normal'} />
      )}
    </div>
  );
}
function ImageField({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const latestChange = useRef(onChange);
  useEffect(() => {
    latestChange.current = onChange;
  }, [onChange]);
  return (
    <div className="space-y-2">
      <AdminUploader
        bucket="catalogue"
        label="Upload image"
        accept=".jpg,.jpeg,.png,.webp"
        initial={value}
        onDone={(v) => latestChange.current(v.url)}
      />
      <Field label="Image URL (or upload above)" value={value} onChange={onChange} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="min-h-11 text-sm underline">
          Remove image
        </button>
      )}
    </div>
  );
}
function Move({ index, length, onMove }: { index: number; length: number; onMove: (to: number) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        className="min-h-11 rounded border px-3 text-sm disabled:opacity-30"
        aria-label="Move up"
      >
        ↑ Up
      </button>
      <button
        type="button"
        disabled={index === length - 1}
        onClick={() => onMove(index + 1)}
        className="min-h-11 rounded border px-3 text-sm disabled:opacity-30"
        aria-label="Move down"
      >
        ↓ Down
      </button>
    </div>
  );
}
function reorder<T>(items: T[], from: number, to: number) {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item!);
  return result;
}

export function WebsiteEditor({
  initial,
  revision: initialRevision,
  products,
}: {
  initial: WebsiteContent;
  revision: number;
  products: { id: string; name: string }[];
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const [content, setContent] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [revision, setRevision] = useState(initialRevision);
  const [tab, setTab] = useState<(typeof tabs)[number]>('Homepage');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const dirty = JSON.stringify(content) !== JSON.stringify(saved);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const leave = (e: MouseEvent) => {
      const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (
        dirty &&
        anchor instanceof HTMLAnchorElement &&
        anchor.target !== '_blank' &&
        !anchor.getAttribute('href')?.startsWith('#') &&
        !window.confirm('Leave this page and discard unpublished changes?')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', leave, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', leave, true);
    };
  }, [dirty]);
  const update = <K extends keyof WebsiteContent>(key: K, value: WebsiteContent[K]) => {
    setContent((c) => ({ ...c, [key]: value }));
    setMessage('');
  };
  const publish = () =>
    startTransition(async () => {
      try {
        const result = await publishWebsite(content, revision);
        setMessage(result.message);
        if (result.ok) {
          setSaved(content);
          setRevision(result.revision!);
        }
      } catch {
        setMessage('Publishing failed. Your changes are still in this editor. Please try again.');
      }
    });
  return (
    <div className="space-y-5" inert={!ready}>
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-paper p-4 shadow-sm">
        <div>
          <p className="font-semibold">{!ready ? 'Loading editor…' : dirty ? 'Unpublished changes' : 'Up to date'}</p>
          <p className="text-xs text-muted">Published version {revision} · changes appear after publishing</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => setPreview(!preview)}
            className="min-h-11 rounded-btn border border-line px-4 text-sm font-semibold"
          >
            {preview ? 'Edit content' : 'Preview content'}
          </button>
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => {
              if (window.confirm('Discard your unpublished changes?')) {
                setContent(saved);
                setMessage('Unpublished changes discarded.');
              }
            }}
            className="min-h-11 px-3 text-sm underline disabled:opacity-40"
          >
            Discard changes
          </button>
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={publish}
            className="min-h-11 rounded-btn bg-ink px-5 font-semibold text-paper disabled:opacity-40"
          >
            {pending ? 'Publishing…' : 'Publish changes'}
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="text-sm font-semibold">
        {message}
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Website sections">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPreview(false);
            }}
            aria-pressed={tab === t}
            className={`min-h-11 rounded-btn border px-4 text-sm ${tab === t ? 'bg-ink text-paper' : 'border-line'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {preview ? (
        <WebsitePreview content={content} tab={tab} />
      ) : (
        <fieldset disabled={pending || !ready} className="space-y-4">
          {tab === 'Brand & SEO' && (
            <div className="grid gap-4 rounded-lg border border-line p-5 sm:grid-cols-2">
              {(['palette', 'headingStyle'] as const).map((key) => (
                <label key={key} className="text-sm font-semibold">
                  {key === 'palette' ? 'Colour palette' : 'Heading style'}
                  <select
                    className={inputCls}
                    value={content.brand[key]}
                    onChange={(e) => update('brand', { ...content.brand, [key]: e.target.value })}
                  >
                    {(key === 'palette' ? ['classic', 'earth', 'forest'] : ['condensed', 'sans', 'serif']).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {(
                Object.keys(content.brand).filter(
                  (key) => !['palette', 'headingStyle'].includes(key),
                ) as (keyof WebsiteContent['brand'])[]
              ).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      name: 'Brand name',
                      byline: 'Brand byline',
                      footer: 'Footer description',
                      copyright: 'Copyright text',
                      seoTitle: 'Default search title',
                      seoDescription: 'Default search description',
                      ogImage: 'Social sharing image URL',
                      maintenanceMessage: 'Maintenance message',
                      palette: 'Colour palette',
                      headingStyle: 'Heading style',
                    }[key]
                  }
                  value={content.brand[key]}
                  multiline={['footer', 'seoDescription', 'maintenanceMessage'].includes(key)}
                  onChange={(value) => update('brand', { ...content.brand, [key]: value })}
                />
              ))}
            </div>
          )}
          {tab === 'Homepage' && (
            <>
              <p className="text-sm text-muted">
                Open a section to edit it. Use Up and Down to change its position. Hide sections you do not need.
              </p>
              {content.sections.map((s, i) => (
                <details key={s.id} className="rounded-lg border border-line p-4">
                  <summary className="cursor-pointer py-2 font-semibold">
                    {String(i + 1).padStart(2, '0')} / {s.id} — {s.enabled ? s.title || 'Visible' : 'Hidden'}
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={s.id === 'hero'}
                          checked={s.enabled}
                          onChange={(e) =>
                            update(
                              'sections',
                              content.sections.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)),
                            )
                          }
                        />
                        Show this section
                      </label>
                      <Move
                        index={i}
                        length={content.sections.length}
                        onMove={(to) => update('sections', reorder(content.sections, i, to))}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          'kicker',
                          'title',
                          'body',
                          'linkText',
                          'href',
                          ...(s.id === 'hero' ? ['secondaryText', 'secondaryHref'] : []),
                        ] as const
                      ).map((key) => (
                        <Field
                          key={key}
                          label={
                            key === 'kicker'
                              ? 'Eyebrow / small heading'
                              : key === 'linkText'
                                ? 'Button or link label'
                                : key === 'href'
                                  ? 'Button or link destination'
                                  : key
                          }
                          value={s[key as keyof typeof s] as string}
                          multiline={key === 'body' || (s.id === 'manifesto' && key === 'title')}
                          onChange={(value) =>
                            update(
                              'sections',
                              content.sections.map((x, j) => (j === i ? { ...x, [key]: value } : x)),
                            )
                          }
                        />
                      ))}
                    </div>
                    <ImageField
                      value={s.image}
                      onChange={(image) =>
                        update(
                          'sections',
                          content.sections.map((x, j) => (j === i ? { ...x, image } : x)),
                        )
                      }
                    />
                    <Field
                      label="Image description (alt text)"
                      value={s.alt}
                      onChange={(alt) =>
                        update(
                          'sections',
                          content.sections.map((x, j) => (j === i ? { ...x, alt } : x)),
                        )
                      }
                    />
                    {s.id === 'featured' && (
                      <div>
                        <p className="mb-2 text-sm">
                          Choose featured products in display order. Leave empty to use catalogue ranking.
                        </p>
                        {content.featuredProductIds.map((id, index) => (
                          <div key={id} className="mb-2 flex flex-wrap items-center gap-3">
                            <span>{products.find((p) => p.id === id)?.name ?? 'Unavailable product'}</span>
                            <Move
                              index={index}
                              length={content.featuredProductIds.length}
                              onMove={(to) =>
                                update('featuredProductIds', reorder(content.featuredProductIds, index, to))
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                update(
                                  'featuredProductIds',
                                  content.featuredProductIds.filter((x) => x !== id),
                                )
                              }
                              className="min-h-11 px-3 underline"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <select
                          aria-label="Add featured product"
                          className={inputCls}
                          value=""
                          onChange={(e) => {
                            if (e.target.value && content.featuredProductIds.length < 12)
                              update('featuredProductIds', [...content.featuredProductIds, e.target.value]);
                          }}
                        >
                          <option value="">Add a featured product…</option>
                          {products
                            .filter((p) => !content.featuredProductIds.includes(p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </>
          )}
          {tab === 'Navigation' &&
            (Object.keys(content.navigation) as (keyof WebsiteContent['navigation'])[]).map((group) => (
              <section key={group} className="space-y-4 rounded-lg border border-line p-5">
                <h2 className="text-xl font-semibold capitalize">
                  {group === 'main'
                    ? 'Main menu (desktop and mobile)'
                    : group === 'shop'
                      ? 'Shop menu and footer collections'
                      : group === 'help'
                        ? 'Help links'
                        : 'Footer legal links'}
                </h2>
                {content.navigation[group].map((item, i) => (
                  <div key={i} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
                    <Field
                      label="Link label"
                      value={item.name}
                      onChange={(name) =>
                        update('navigation', {
                          ...content.navigation,
                          [group]: content.navigation[group].map((x, j) => (j === i ? { ...x, name } : x)),
                        })
                      }
                    />
                    <Field
                      label="Destination"
                      value={item.href}
                      onChange={(href) =>
                        update('navigation', {
                          ...content.navigation,
                          [group]: content.navigation[group].map((x, j) => (j === i ? { ...x, href } : x)),
                        })
                      }
                    />
                    <Move
                      index={i}
                      length={content.navigation[group].length}
                      onMove={(to) =>
                        update('navigation', {
                          ...content.navigation,
                          [group]: reorder(content.navigation[group], i, to),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="min-h-11 text-left text-sm underline"
                      onClick={() =>
                        update('navigation', {
                          ...content.navigation,
                          [group]: content.navigation[group].filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remove link
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="min-h-11 rounded border px-4 text-sm"
                  onClick={() =>
                    update('navigation', {
                      ...content.navigation,
                      [group]: [...content.navigation[group], { name: 'New link', href: '/' }],
                    })
                  }
                >
                  + Add link
                </button>
              </section>
            ))}
          {tab === 'Collections' &&
            content.collections.map((c, i) => (
              <details key={c.slug} className="rounded-lg border border-line p-5">
                <summary className="cursor-pointer font-semibold">{c.name}</summary>
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-muted">Address: /collections/{c.slug}. Assign products in Catalogue.</p>
                  <label className="flex min-h-11 gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) =>
                        update(
                          'collections',
                          content.collections.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)),
                        )
                      }
                    />
                    Show in collection grids
                  </label>
                  <Move
                    index={i}
                    length={content.collections.length}
                    onMove={(to) => update('collections', reorder(content.collections, i, to))}
                  />
                  {(['name', 'blurb'] as const).map((key) => (
                    <Field
                      key={key}
                      label={key}
                      value={c[key]}
                      onChange={(value) =>
                        update(
                          'collections',
                          content.collections.map((x, j) => (j === i ? { ...x, [key]: value } : x)),
                        )
                      }
                    />
                  ))}
                  <ImageField
                    value={c.image}
                    onChange={(image) =>
                      update(
                        'collections',
                        content.collections.map((x, j) => (j === i ? { ...x, image } : x)),
                      )
                    }
                  />
                </div>
              </details>
            ))}
          {tab === 'Community photos' && (
            <>
              <p className="text-sm text-muted">
                Add photographs only with the person's permission to publish. Images appear in the homepage Community
                section.
              </p>
              {content.community.map((photo, i) => (
                <div key={i} className="space-y-4 rounded-lg border border-line p-5">
                  <ImageField
                    value={photo.image}
                    onChange={(image) =>
                      update(
                        'community',
                        content.community.map((x, j) => (j === i ? { ...x, image } : x)),
                      )
                    }
                  />
                  <Field
                    label="Describe the photograph"
                    value={photo.alt}
                    onChange={(alt) =>
                      update(
                        'community',
                        content.community.map((x, j) => (j === i ? { ...x, alt } : x)),
                      )
                    }
                  />
                  <Field
                    label="Caption or credited handle"
                    value={photo.caption}
                    onChange={(caption) =>
                      update(
                        'community',
                        content.community.map((x, j) => (j === i ? { ...x, caption } : x)),
                      )
                    }
                  />
                  <Move
                    index={i}
                    length={content.community.length}
                    onMove={(to) => update('community', reorder(content.community, i, to))}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        'community',
                        content.community.filter((_, j) => i !== j),
                      )
                    }
                    className="min-h-11 underline"
                  >
                    Remove photograph
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="min-h-11 rounded border px-4"
                onClick={() => {
                  if (
                    content.community.length < 12 &&
                    window.confirm('Do you have permission to publish this photograph?')
                  )
                    update('community', [...content.community, { image: '', alt: '', caption: '', permission: true }]);
                }}
              >
                + Add photograph with permission
              </button>
            </>
          )}
          {tab === 'Pages' && (
            <>
              <p className="text-sm text-muted">
                Turn on your edited content to replace an existing information page. Use blank lines between paragraphs,
                ## for a heading and - for list items. Add links as [label](/contact). Checkout prices and delivery
                rules are managed in Store settings.
              </p>
              {content.pages.map((p, i) => (
                <details key={p.slug} className="rounded-lg border border-line p-5">
                  <summary className="cursor-pointer font-semibold">
                    {p.title} — {p.enabled ? 'Enabled' : 'Original content / disabled'}
                  </summary>
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-muted">
                      Address:{' '}
                      {(EXISTING_PAGES as readonly string[]).includes(p.slug) ? `/${p.slug}` : `/pages/${p.slug}`}
                    </p>
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) =>
                          update(
                            'pages',
                            content.pages.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)),
                          )
                        }
                      />
                      Use this content on the website
                    </label>
                    {(['title', 'kicker', 'intro', 'body', 'seoDescription', 'alt'] as const).map((key) => (
                      <Field
                        key={key}
                        label={
                          key === 'title'
                            ? 'Page title'
                            : key === 'body'
                              ? 'Page content'
                              : key === 'seoDescription'
                                ? 'Search description'
                                : key === 'alt'
                                  ? 'Image description'
                                  : key
                        }
                        value={p[key]}
                        multiline={['intro', 'body', 'seoDescription'].includes(key)}
                        onChange={(value) =>
                          update(
                            'pages',
                            content.pages.map((x, j) => (j === i ? { ...x, [key]: value } : x)),
                          )
                        }
                      />
                    ))}
                    <ImageField
                      value={p.image}
                      onChange={(image) =>
                        update(
                          'pages',
                          content.pages.map((x, j) => (j === i ? { ...x, image } : x)),
                        )
                      }
                    />
                  </div>
                </details>
              ))}
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-5">
                <div className="grow">
                  <Field label="New page address (for example, our-mission)" value={newSlug} onChange={setNewSlug} />
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded border px-4"
                  onClick={() => {
                    if (
                      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newSlug) ||
                      newSlug.length > 60 ||
                      content.pages.some((p) => p.slug === newSlug)
                    ) {
                      setMessage('Choose a unique address using lowercase letters, numbers and dashes.');
                      return;
                    }
                    update('pages', [
                      ...content.pages,
                      {
                        slug: newSlug,
                        enabled: false,
                        title: newSlug.replaceAll('-', ' '),
                        kicker: '',
                        intro: '',
                        body: '',
                        image: '',
                        alt: '',
                        seoDescription: '',
                      },
                    ]);
                    setNewSlug('');
                  }}
                >
                  + Create page
                </button>
              </div>
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}
