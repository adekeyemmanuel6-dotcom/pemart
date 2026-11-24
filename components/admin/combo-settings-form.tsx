'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ActionForm } from './action-form';
import { AdminUploader } from './admin-uploader';
import { inputCls, labelCls } from './ui';
import { saveComboSettingsAction } from '@/lib/admin/actions-combos';
import type { ComboSettings } from '@/lib/combos/schema';

const card = 'rounded-lg border border-line bg-sand/40 p-4';
export function ComboSettingsForm({ initial }: { initial: ComboSettings }) {
  const [s, setS] = useState<ComboSettings>(initial);
  const cols = (p: Partial<ComboSettings['collections']>) => setS((x) => ({ ...x, collections: { ...x.collections, ...p } }));
  const calc = (p: Partial<ComboSettings['calculator']>) => setS((x) => ({ ...x, calculator: { ...x.calculator, ...p } }));
  const story = (p: Partial<ComboSettings['story']>) => setS((x) => ({ ...x, story: { ...x.story, ...p } }));
  const T = ({ id, label, value, onChange, area }: { id: string; label: string; value: string; onChange: (v: string) => void; area?: boolean }) => (
    <div><label className={labelCls} htmlFor={id}>{label}</label>{area ? <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} py-2`} /> : <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />}</div>
  );
  const Check = ({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm"><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-ink" />{label}</label>
  );
  return (
    <ActionForm action={saveComboSettingsAction} submitLabel="Save website text" pendingLabel="Saving…" className="space-y-4">
      <input type="hidden" name="payload" value={JSON.stringify(s)} />
      <section className={card} aria-label="Switches"><h2 className="display mb-2 text-2xl">Where the calculator appears</h2>
        <Check id="cs-en" label="Show “Build Your Combo” on the website" checked={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} />
        <div className="grid gap-3 sm:grid-cols-2"><T id="cs-hl" label="Header link text" value={s.headerLabel} onChange={(v) => setS({ ...s, headerLabel: v })} /><T id="cs-hc" label="Homepage hero button text" value={s.heroCta.label} onChange={(v) => setS({ ...s, heroCta: { ...s.heroCta, label: v } })} /></div>
        <Check id="cs-hs" label="Show the secondary button in the homepage hero" checked={s.heroCta.show} onChange={(v) => setS({ ...s, heroCta: { ...s.heroCta, show: v } })} /></section>
      <section className={card} aria-label="Collections section"><h2 className="display mb-2 text-2xl">Homepage, menu and footer: your collections</h2>
        <p className="mb-2 text-sm text-muted">Shows your published collections (Behold, Abide, The Doer&apos;s) and the Couples Collection. The same list fills the Collections menu and the footer. It replaces the older &ldquo;collections&rdquo; homepage section.</p>
        <Check id="cl-show" label="Show the collections section on the homepage" checked={s.collections.show} onChange={(v) => cols({ show: v })} />
        <div className="grid gap-3 sm:grid-cols-2"><T id="cl-k" label="Small heading" value={s.collections.kicker} onChange={(v) => cols({ kicker: v })} /><T id="cl-h" label="Headline" value={s.collections.headline} onChange={(v) => cols({ headline: v })} />
          <div className="sm:col-span-2"><T id="cl-b" label="Text" area value={s.collections.body} onChange={(v) => cols({ body: v })} /></div>
          <T id="cl-c" label="Card button text" value={s.collections.cta} onChange={(v) => cols({ cta: v })} />
          <T id="cl-cn" label="Name of the couples collection" value={s.collections.couplesName} onChange={(v) => cols({ couplesName: v })} />
          <div className="sm:col-span-2"><T id="cl-ct" label="Couples collection line" value={s.collections.couplesTagline} onChange={(v) => cols({ couplesTagline: v })} /></div>
          <div className="sm:col-span-2"><T id="cl-ci" label="Couples collection picture link (optional)" value={s.collections.couplesImageUrl} onChange={(v) => cols({ couplesImageUrl: v })} /><div className="mt-2"><AdminUploader bucket="catalogue" label="Upload a picture" accept=".png,.jpg,.jpeg,.webp" onDone={(v) => cols({ couplesImageUrl: v.url })} /></div></div></div></section>
      <section className={card} aria-label="Homepage calculator section"><h2 className="display mb-2 text-2xl">Homepage: “Your Word. Your Style. Your Combo.”</h2>
        <Check id="cc-show" label="Show this section on the homepage" checked={s.calculator.show} onChange={(v) => calc({ show: v })} />
        <div className="grid gap-3 sm:grid-cols-2"><T id="cc-k" label="Small heading" value={s.calculator.kicker} onChange={(v) => calc({ kicker: v })} /><T id="cc-h" label="Headline" value={s.calculator.headline} onChange={(v) => calc({ headline: v })} />
          <div className="sm:col-span-2"><T id="cc-b" label="Text" area value={s.calculator.body} onChange={(v) => calc({ body: v })} /></div><T id="cc-c" label="Button text" value={s.calculator.cta} onChange={(v) => calc({ cta: v })} />
          <div><T id="cc-i" label="Picture link" value={s.calculator.imageUrl} onChange={(v) => calc({ imageUrl: v })} /><div className="mt-2"><AdminUploader bucket="catalogue" label="Upload a picture" accept=".png,.jpg,.jpeg,.webp" onDone={(v) => calc({ imageUrl: v.url })} /></div></div>
          <T id="cc-a" label="Describe the picture (for screen readers)" value={s.calculator.imageAlt} onChange={(v) => calc({ imageAlt: v })} /></div></section>
      <section className={card} aria-label="Brand story section"><h2 className="display mb-2 text-2xl">Homepage: brand story</h2>
        <Check id="cb-show" label="Show this section on the homepage" checked={s.story.show} onChange={(v) => story({ show: v })} />
        <div className="grid gap-3 sm:grid-cols-2"><T id="cb-k" label="Small heading" value={s.story.kicker} onChange={(v) => story({ kicker: v })} /><T id="cb-h" label="Headline" value={s.story.headline} onChange={(v) => story({ headline: v })} /></div>
        <div className="mt-3 space-y-2"><p className={labelCls}>Paragraphs</p>
          {s.story.paragraphs.map((p, i) => (<div key={i} className="flex gap-2"><textarea aria-label={`Paragraph ${i + 1}`} rows={3} value={p} onChange={(e) => story({ paragraphs: s.story.paragraphs.map((x, j) => (j === i ? e.target.value : x)) })} className={`${inputCls} py-2`} />
            <button type="button" onClick={() => story({ paragraphs: s.story.paragraphs.filter((_, j) => j !== i) })} aria-label={`Remove paragraph ${i + 1}`} className="grid size-11 shrink-0 place-items-center rounded border border-line hover:bg-sand"><Trash2 className="size-4" aria-hidden /></button></div>))}
          {s.story.paragraphs.length < 6 && <button type="button" onClick={() => story({ paragraphs: [...s.story.paragraphs, ''] })} className="inline-flex min-h-11 items-center gap-1 rounded-btn border-2 border-line px-3 text-sm font-semibold hover:border-ink"><Plus className="size-4" aria-hidden />Add paragraph</button>}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><T id="cb-cl" label="Closing line" value={s.story.closing} onChange={(v) => story({ closing: v })} /><T id="cb-cta" label="Button text" value={s.story.cta} onChange={(v) => story({ cta: v })} />
          <div><T id="cb-i" label="Picture link" value={s.story.imageUrl} onChange={(v) => story({ imageUrl: v })} /><div className="mt-2"><AdminUploader bucket="catalogue" label="Upload a picture" accept=".png,.jpg,.jpeg,.webp" onDone={(v) => story({ imageUrl: v.url })} /></div></div>
          <T id="cb-a" label="Describe the picture (for screen readers)" value={s.story.imageAlt} onChange={(v) => story({ imageAlt: v })} /></div></section>
      <section className={card} aria-label="Combos page"><h2 className="display mb-2 text-2xl">The “Combo Collections” page</h2>
        <div className="grid gap-3 sm:grid-cols-2"><T id="cp-h" label="Headline" value={s.page.headline} onChange={(v) => setS({ ...s, page: { ...s.page, headline: v } })} /><T id="cp-i" label="Intro" area value={s.page.intro} onChange={(v) => setS({ ...s, page: { ...s.page, intro: v } })} /></div></section>
    </ActionForm>
  );
}
