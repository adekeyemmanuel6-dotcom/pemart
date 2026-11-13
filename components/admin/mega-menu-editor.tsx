'use client';
import type { NavPanel } from '@/lib/navigation';
import type { MegaMenu, MegaMenuPanel } from '@/lib/website/schema';
import { Field, ImageField, Move, reorder } from './editor-fields';
import { inputCls } from './ui';

type Show = 'all' | 'desktop' | 'mobile';
const SHOW_LABEL: Record<Show, string> = { all: 'Desktop and phone', desktop: 'Desktop only', mobile: 'Phone only' };
const btn = 'min-h-11 rounded border px-3 text-sm';

const blankFeature = (): MegaMenuPanel['feature'] => ({ enabled: false, eyebrow: '', title: '', cta: '', href: '/collections/all', image: '', alt: '' });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'menu';

/** Turn the automatic (catalogue-built) menu into editable panels: the starting point for a custom menu. */
export function panelsFromAutomatic(auto: NavPanel[]): MegaMenuPanel[] {
  return auto.map((p) => ({
    id: p.id,
    label: p.label,
    href: p.href,
    show: 'all',
    columns: p.columns.map((c) => ({ heading: c.heading, links: c.links.map((l) => ({ name: l.name, href: l.href, show: 'all' as Show })) })),
    feature: p.feature
      ? { enabled: true, eyebrow: p.feature.eyebrow, title: p.feature.title, cta: p.feature.cta, href: p.feature.href, image: p.feature.image ?? '', alt: p.feature.imageAlt }
      : blankFeature(),
  }));
}

function ShowSelect({ value, onChange, label }: { value: Show; onChange: (v: Show) => void; label: string }) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-1 block">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Show)} className={inputCls + ' font-normal'}>
        {(Object.keys(SHOW_LABEL) as Show[]).map((s) => (<option key={s} value={s}>{SHOW_LABEL[s]}</option>))}
      </select>
    </label>
  );
}

/**
 * Header menu builder. Automatic: built from live products (nothing to maintain). Custom: menu items (panels),
 * each with up to 4 columns of links and an optional featured image card. Depth is fixed, so menus cannot
 * nest into loops; links are validated as site paths or https URLs when publishing.
 */
export function MegaMenuEditor({ value, onChange, automatic }: { value: MegaMenu | undefined; onChange: (m: MegaMenu) => void; automatic: NavPanel[] }) {
  const menu: MegaMenu = value ?? { mode: 'automatic', panels: [] };
  const set = (panels: MegaMenuPanel[]) => onChange({ ...menu, panels });
  const setPanel = (i: number, p: Partial<MegaMenuPanel>) => set(menu.panels.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="space-y-5">
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 font-semibold">How the header menu is built</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {([
            ['automatic', 'Automatic', 'Built from your live products, gift boxes and collections. Updates itself.'],
            ['custom', 'Custom', 'You choose every menu item, column, link and featured image.'],
          ] as const).map(([mode, title, copy]) => (
            <label key={mode} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${menu.mode === mode ? 'border-ink' : 'border-line'}`}>
              <input type="radio" name="menu-mode" className="mt-1 size-5 accent-ink" checked={menu.mode === mode}
                onChange={() => onChange({ mode, panels: mode === 'custom' && menu.panels.length === 0 ? panelsFromAutomatic(automatic) : menu.panels })} />
              <span><span className="font-semibold">{title}</span><span className="block text-sm text-muted">{copy}</span></span>
            </label>
          ))}
        </div>
        {menu.mode === 'custom' && (
          <button type="button" className={`${btn} mt-3`}
            onClick={() => { if (window.confirm('Replace your custom menu with a copy of the automatic menu?')) set(panelsFromAutomatic(automatic)); }}>
            Start again from the automatic menu
          </button>
        )}
      </fieldset>

      {menu.mode === 'custom' && (
        <>
          {menu.panels.map((p, i) => (
            <fieldset key={i} className="space-y-4 rounded-lg border border-line p-4">
              <legend className="px-1 font-semibold">Menu item {i + 1}: {p.label || 'untitled'}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Move index={i} length={menu.panels.length} onMove={(to) => set(reorder(menu.panels, i, to))} />
                <button type="button" className={`${btn} text-ember`} onClick={() => { if (window.confirm(`Remove “${p.label}” from the menu?`)) set(menu.panels.filter((_, j) => j !== i)); }}>Remove menu item</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Menu label" value={p.label} onChange={(v) => setPanel(i, { label: v })} />
                <Field label="Where the label links to (phones)" value={p.href} onChange={(v) => setPanel(i, { href: v })} />
                <Field label="ID (letters, numbers, dashes)" value={p.id} onChange={(v) => setPanel(i, { id: slug(v) })} />
                <ShowSelect label="Show on" value={p.show} onChange={(v) => setPanel(i, { show: v })} />
              </div>

              {p.columns.map((c, ci) => (
                <div key={ci} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-48 flex-1"><Field label={`Column ${ci + 1} heading`} value={c.heading} onChange={(v) => setPanel(i, { columns: p.columns.map((x, k) => (k === ci ? { ...x, heading: v } : x)) })} /></div>
                    <Move index={ci} length={p.columns.length} onMove={(to) => setPanel(i, { columns: reorder(p.columns, ci, to) })} />
                    <button type="button" disabled={p.columns.length === 1} className={`${btn} disabled:opacity-30`} onClick={() => setPanel(i, { columns: p.columns.filter((_, k) => k !== ci) })}>Remove column</button>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {c.links.map((l, li) => {
                      const setLinks = (links: typeof c.links) => setPanel(i, { columns: p.columns.map((x, k) => (k === ci ? { ...x, links } : x)) });
                      const setLink = (patch: Partial<(typeof c.links)[number]>) => setLinks(c.links.map((y, m) => (m === li ? { ...y, ...patch } : y)));
                      return (
                        <li key={li} className="grid gap-2 rounded border border-line/60 p-2 md:grid-cols-[1fr_1fr_170px_auto] md:items-end">
                          <Field label="Link text" value={l.name} onChange={(v) => setLink({ name: v })} />
                          <Field label="Destination" value={l.href} onChange={(v) => setLink({ href: v })} />
                          <ShowSelect label="Show on" value={l.show} onChange={(v) => setLink({ show: v })} />
                          <div className="flex gap-1">
                            <Move index={li} length={c.links.length} onMove={(to) => setLinks(reorder(c.links, li, to))} />
                            <button type="button" disabled={c.links.length === 1} aria-label={`Remove link ${l.name}`} className={`${btn} disabled:opacity-30`} onClick={() => setLinks(c.links.filter((_, m) => m !== li))}>✕</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" disabled={c.links.length >= 10} className={`${btn} mt-2 disabled:opacity-30`}
                    onClick={() => setPanel(i, { columns: p.columns.map((x, k) => (k === ci ? { ...x, links: [...x.links, { name: 'New link', href: '/collections/all', show: 'all' }] } : x)) })}>
                    Add link
                  </button>
                </div>
              ))}
              <button type="button" disabled={p.columns.length >= 4} className={`${btn} disabled:opacity-30`}
                onClick={() => setPanel(i, { columns: [...p.columns, { heading: 'New column', links: [{ name: 'New link', href: '/collections/all', show: 'all' }] }] })}>
                Add column
              </button>

              <div className="rounded-md border border-line p-3">
                <label className="flex min-h-11 items-center gap-2 font-semibold">
                  <input type="checkbox" className="size-5 accent-ink" checked={p.feature.enabled} onChange={(e) => setPanel(i, { feature: { ...p.feature, enabled: e.target.checked } })} />
                  Featured card in this menu (desktop)
                </label>
                {p.feature.enabled && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Small heading" value={p.feature.eyebrow} onChange={(v) => setPanel(i, { feature: { ...p.feature, eyebrow: v } })} />
                    <Field label="Card title" value={p.feature.title} onChange={(v) => setPanel(i, { feature: { ...p.feature, title: v } })} />
                    <Field label="Button text" value={p.feature.cta} onChange={(v) => setPanel(i, { feature: { ...p.feature, cta: v } })} />
                    <Field label="Card destination" value={p.feature.href} onChange={(v) => setPanel(i, { feature: { ...p.feature, href: v } })} />
                    <div className="sm:col-span-2"><ImageField value={p.feature.image} onChange={(v) => setPanel(i, { feature: { ...p.feature, image: v } })} /></div>
                    {p.feature.image && <div className="sm:col-span-2"><Field label="Image description (for screen readers)" value={p.feature.alt} onChange={(v) => setPanel(i, { feature: { ...p.feature, alt: v } })} /></div>}
                  </div>
                )}
              </div>
            </fieldset>
          ))}
          <button type="button" disabled={menu.panels.length >= 6} className={`${btn} disabled:opacity-30`}
            onClick={() => {
              const n = menu.panels.length + 1;
              set([...menu.panels, { id: `menu-${n}`, label: 'New menu', href: '/collections/all', show: 'all', columns: [{ heading: 'Links', links: [{ name: 'Shop all', href: '/collections/all', show: 'all' }] }], feature: blankFeature() }]);
            }}>
            Add menu item
          </button>
          <p className="text-sm text-muted">Up to 6 menu items, 4 columns each and 10 links per column. Destinations must be a page on this site (starting with /) or a secure https:// address. Changes go live when you publish.</p>
        </>
      )}
    </div>
  );
}
