'use client';
import { MAX_CUSTOM_SECTIONS, SECTION_TEMPLATES, type SectionTemplate, type WebsiteSection } from '@/lib/website/schema';
import { TEMPLATE_INFO, newSection } from '@/lib/website/templates';
import { Field, Move, reorder } from './editor-fields';
import { inputCls } from './ui';

const btn = 'min-h-11 rounded border px-3 text-sm';

/** Extra fields for a section added from a template (image side, products source, questions). */
export function TemplateFields({ s, onChange, collections }: { s: WebsiteSection; onChange: (patch: Partial<WebsiteSection>) => void; collections: { slug: string; name: string }[] }) {
  if (s.template === 'image_text') {
    return (
      <label className="block text-sm font-semibold">
        <span className="mb-1 block">Photo position</span>
        <select value={s.imageSide ?? 'left'} onChange={(e) => onChange({ imageSide: e.target.value as 'left' | 'right' })} className={inputCls + ' font-normal'}>
          <option value="left">Photo on the left</option><option value="right">Photo on the right</option>
        </select>
      </label>
    );
  }
  if (s.template === 'products') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          <span className="mb-1 block">Which products</span>
          <select value={s.collection ?? ''} onChange={(e) => onChange({ collection: e.target.value })} className={inputCls + ' font-normal'}>
            <option value="">Newest products</option>
            {collections.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          <span className="mb-1 block">How many</span>
          <select value={s.limit ?? 4} onChange={(e) => onChange({ limit: Number(e.target.value) })} className={inputCls + ' font-normal'}>
            {[2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <p className="text-sm text-muted sm:col-span-2">Only products that are Active show. The section hides itself when there are none.</p>
      </div>
    );
  }
  if (s.template === 'faq') {
    const items = s.items ?? [];
    const set = (next: typeof items) => onChange({ items: next });
    return (
      <div className="space-y-3">
        {items.map((q, i) => (
          <div key={i} className="space-y-2 rounded border border-line/70 p-3">
            <Field label={`Question ${i + 1}`} value={q.title} onChange={(v) => set(items.map((x, j) => (j === i ? { ...x, title: v } : x)))} />
            <Field label="Answer" value={q.body} multiline onChange={(v) => set(items.map((x, j) => (j === i ? { ...x, body: v } : x)))} />
            <div className="flex gap-2">
              <Move index={i} length={items.length} onMove={(to) => set(reorder(items, i, to))} />
              <button type="button" className={btn} onClick={() => set(items.filter((_, j) => j !== i))}>Remove question</button>
            </div>
          </div>
        ))}
        <button type="button" className={`${btn} disabled:opacity-30`} disabled={items.length >= 12} onClick={() => set([...items, { title: 'New question', body: '' }])}>Add question</button>
      </div>
    );
  }
  return null;
}

/** Template picker shown under the homepage sections. */
export function AddSection({ count, onAdd }: { count: number; onAdd: (s: WebsiteSection) => void }) {
  const full = count >= MAX_CUSTOM_SECTIONS;
  return (
    <fieldset className="rounded-lg border border-dashed border-line p-4">
      <legend className="px-1 font-semibold">Add a section</legend>
      <p className="mb-3 text-sm text-muted">{full ? `You have the maximum of ${MAX_CUSTOM_SECTIONS} added sections.` : 'New sections start hidden with example words. Edit them, switch on “Show this section”, then publish.'}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SECTION_TEMPLATES.map((t: SectionTemplate) => (
          <button key={t} type="button" disabled={full} onClick={() => onAdd(newSection(t))}
            className="rounded-lg border border-line p-3 text-left hover:border-gold disabled:opacity-40">
            <span className="block font-semibold">{TEMPLATE_INFO[t].label}</span>
            <span className="block text-xs text-muted">{TEMPLATE_INFO[t].detail}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
