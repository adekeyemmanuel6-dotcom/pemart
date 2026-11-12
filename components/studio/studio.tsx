'use client';
import Link from 'next/link';
import { track } from '@/lib/analytics';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Check, Clock } from 'lucide-react';
import { saveCustomRequest } from '@/lib/actions/custom';
import { useBag } from '@/lib/cart-store';
import { colourHex, colourNeedsDarkInk } from '@/lib/colours';
import { customRequestSchema, type CustomRequestInput } from '@/lib/custom/schema';
import type { PrintDraft } from '@/lib/custom/draft';
import { PRINT_POSITIONS, TIER_LIST, TIERS, TYPE_STYLES, type PrintPosition, type TierId, type TypeStyleId } from '@/lib/custom/tiers';
import { formatNaira } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { GarmentMockup } from '@/components/product/garment-mockup';
import { FileUploader } from './file-uploader';
import { PrintArea } from './print-area';
import { STYLE_FONT } from './studio-fonts';

export type StudioDesign = { slug: string; name: string; fields: string[] };
const COLOURS = { tee: ['Black', 'Sand', 'Blue Jean', 'Mocha', 'Navy'], hoodie: ['Black', 'Sand', 'Mocha'] } as const;
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;

export function Studio({ designs, basePrices }: { designs: StudioDesign[]; basePrices: { tee: number; hoodie: number } }) {
  const add = useBag((s) => s.add);
  const [pending, start] = useTransition();
  const [tier, setTier] = useState<TierId>('text_design');
  const [productType, setProductType] = useState<'tee' | 'hoodie'>('tee');
  const [colour, setColour] = useState<string>('Black');
  const [size, setSize] = useState<string>('');
  const [position, setPosition] = useState<PrintPosition>('back');
  const [designSlug, setDesignSlug] = useState<string>('');
  const [date, setDate] = useState(''); const [verse, setVerse] = useState('');
  const [lines, setLines] = useState<string[]>(['', '']);
  const [typeStyle, setTypeStyle] = useState<TypeStyleId>('heavy');
  const [notes, setNotes] = useState('');
  const [paths, setPaths] = useState<string[]>([]);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; message: string; demo?: boolean } | null>(null);

  useEffect(() => () => { if (uploadUrl) URL.revokeObjectURL(uploadUrl); }, [uploadUrl]);
  useEffect(() => { if (!(COLOURS[productType] as readonly string[]).includes(colour)) setColour('Black'); }, [productType, colour]);

  const design = designs.find((d) => d.slug === designSlug);
  const tierInfo = TIERS[tier];
  const total = basePrices[productType] + tierInfo.feeKobo;
  const dark = colourNeedsDarkInk(colour);
  const ink = dark ? '#141414' : '#F6F1E8';

  const draft: PrintDraft = useMemo(() => ({
    tier, designSlug: designSlug || undefined, date: design?.fields.includes('date') ? date : undefined,
    verse: design?.fields.includes('verse') ? verse : undefined, textLines: lines, typeStyle, uploadUrl,
  }), [tier, designSlug, design, date, verse, lines, typeStyle, uploadUrl]);

  const showFront = position !== 'back', showBack = position !== 'front';

  const setPreview = (file: File | null) => {
    setUploadUrl((old) => { if (old) URL.revokeObjectURL(old); return file && file.type !== 'application/pdf' ? URL.createObjectURL(file) : null; });
  };

  function submit() {
    const input: CustomRequestInput = {
      tier, productType, colour: colour as 'Black', size: size as 'M', printPositions: position,
      designSlug: tier === 'personalise' ? designSlug || undefined : undefined,
      typeStyle: tier === 'text_design' ? typeStyle : undefined,
      textLines: tier === 'text_design' ? lines : [],
      date: tier === 'personalise' ? date || undefined : undefined, verse: tier === 'personalise' ? verse || undefined : undefined,
      notes: tier === 'full_custom' ? notes || undefined : undefined,
      uploadPaths: tier === 'full_custom' ? paths : [], rightsConfirmed: tier === 'full_custom' ? rights : undefined,
    };
    const errs: Record<string, string> = {};
    if (!size) errs.size = 'Choose a size';
    const local = customRequestSchema.safeParse(input);
    if (!local.success) for (const i of local.error.issues) errs[String(i.path[0])] ??= i.message;
    setErrors(errs); setResult(null);
    if (Object.keys(errs).length) return;
    start(async () => {
      const res = await saveCustomRequest(input);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); setResult({ ok: false, message: res.message }); return; }
      const summary = `${tierInfo.name} · ${colour} ${productType} · ${size} · ${PRINT_POSITIONS.find((p) => p.id === position)!.label.toLowerCase()}`;
      add({ id: crypto.randomUUID(), kind: 'custom', refId: res.id, quantity: 1, selection: { request: input, persisted: res.persisted, summary, feeKobo: res.feeKobo } });
      if (res.persisted) track('custom_design_enquiry', { items: [], valueKobo: 0 });
      setResult({ ok: true, demo: !res.persisted, message: 'Added to your bag.' });
    });
  }

  const chip = (on: boolean) => `inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border-2 px-3 text-sm font-semibold ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-white hover:border-ink'}`;
  const Err = ({ k }: { k: string }) => (errors[k] ? <p role="alert" className="mt-1 text-sm text-ember">{errors[k]}</p> : null);
  const mock = (view: 'front' | 'back', on: boolean) => (
    <figure>
      <GarmentMockup type={productType} colour={colour} view={view} designSlug={null} className="rounded-lg">
        {on && <PrintArea draft={draft} view={view} ink={ink} fonts={STYLE_FONT} />}
      </GarmentMockup>
      <figcaption className="mt-1 text-center text-sm font-semibold">{view === 'front' ? 'Front' : 'Back'}{!on && <span className="font-normal text-muted"> (plain)</span>}</figcaption>
    </figure>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <div className="order-2 space-y-8 lg:order-1">
        <fieldset>
          <legend className="display mb-3 text-3xl">1. Choose your lane</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {TIER_LIST.map((t) => (
              <label key={t.id} className={`flex cursor-pointer flex-col rounded-lg border-2 p-4 ${tier === t.id ? 'border-ink bg-white' : 'border-line'}`}>
                <input type="radio" name="tier" className="sr-only" checked={tier === t.id} onChange={() => setTier(t.id)} />
                <span className="flex items-center justify-between"><span className="display text-2xl">{t.name}</span>{tier === t.id && <Check className="size-5" aria-hidden />}</span>
                <span className="mt-1 text-lg font-bold">+{formatNaira(t.feeKobo)}</span>
                <span className="mt-1 text-sm text-muted">{t.blurb}</span>
                <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-mocha"><Clock className="size-4" aria-hidden />Proof in {t.proofHours} hours</span>
              </label>
            ))}
          </div>
        </fieldset>

        <section aria-labelledby="g-h" className="space-y-5">
          <h2 id="g-h" className="display text-3xl">2. The garment</h2>
          <fieldset><legend className="mb-2 text-sm font-semibold">Garment</legend>
            <div className="flex gap-2">{(['tee', 'hoodie'] as const).map((t) => (<button key={t} type="button" aria-pressed={productType === t} onClick={() => setProductType(t)} className={chip(productType === t)}>{t === 'tee' ? `Oversized tee · ${formatNaira(basePrices.tee)}` : `Hoodie · ${formatNaira(basePrices.hoodie)}`}</button>))}</div></fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">Colour<span className="font-normal text-muted">: {colour}</span></legend>
            <div className="flex flex-wrap gap-2">{COLOURS[productType].map((c) => (<button key={c} type="button" aria-pressed={colour === c} aria-label={c} onClick={() => setColour(c)} className={`grid size-12 place-items-center rounded-full border-2 ${colour === c ? 'border-ink' : 'border-line'}`}><span className="size-8 rounded-full border border-ink/20" style={{ background: colourHex(c) }} /></button>))}</div></fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">Size</legend>
            <div className="flex flex-wrap gap-2">{SIZES.map((s) => (<button key={s} type="button" aria-pressed={size === s} onClick={() => { setSize(s); setErrors((e) => { const { size: _drop, ...rest } = e; void _drop; return rest; }); }} className={chip(size === s)}>{s}</button>))}</div><Err k="size" /></fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">Print position</legend>
            <div className="flex flex-wrap gap-2">{PRINT_POSITIONS.map((p) => (<button key={p.id} type="button" aria-pressed={position === p.id} onClick={() => setPosition(p.id)} className={chip(position === p.id)}>{p.label}</button>))}</div></fieldset>
        </section>

        <section aria-labelledby="d-h" className="space-y-5">
          <h2 id="d-h" className="display text-3xl">3. Your design</h2>

          {tier === 'personalise' && (<>
            <fieldset><legend className="mb-2 text-sm font-semibold">Start from a design{design ? <span className="font-normal text-muted">: {design.name}</span> : ''}</legend>
              <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">{designs.map((d) => (
                <li key={d.slug}><button type="button" aria-pressed={designSlug === d.slug} onClick={() => setDesignSlug(d.slug)} className={`block w-full overflow-hidden rounded-md border-2 text-left ${designSlug === d.slug ? 'border-ink' : 'border-line'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/designs/${d.slug}-card.svg`} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" /><span className="block px-1.5 py-1 text-xs font-semibold leading-tight">{d.name}</span></button></li>))}</ul><Err k="designSlug" /></fieldset>
            {design && (<div className="grid gap-4 sm:grid-cols-2">
              {design.fields.includes('date') && <div><Label htmlFor="c-date">Date</Label><Input id="c-date" value={date} maxLength={40} onChange={(e) => setDate(e.target.value)} placeholder="e.g. 14.02.2027" /></div>}
              {design.fields.includes('verse') && <div className="sm:col-span-2"><Label htmlFor="c-verse">Verse or line of text</Label><Input id="c-verse" value={verse} maxLength={160} onChange={(e) => setVerse(e.target.value)} placeholder="Printed under the design" /></div>}
            </div>)}
            
          </>)}

          {tier === 'text_design' && (<>
            <fieldset><legend className="mb-2 text-sm font-semibold">Your words (up to 4 lines)</legend>
              <div className="space-y-2">{lines.map((l, i) => (<Input key={i} aria-label={`Line ${i + 1}`} value={l} maxLength={40} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? 'e.g. GRACE UPON GRACE' : `Line ${i + 1} (optional)`} />))}</div>
              {lines.length < 4 && <button type="button" className="mt-2 min-h-11 text-sm font-semibold underline underline-offset-4" onClick={() => setLines((l) => [...l, ''])}>Add a line</button>}<Err k="textLines" /></fieldset>
            <fieldset><legend className="mb-2 text-sm font-semibold">Type style</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{TYPE_STYLES.map((t) => (
                <button key={t.id} type="button" aria-pressed={typeStyle === t.id} onClick={() => setTypeStyle(t.id)} className={`min-h-16 rounded-btn border-2 px-3 py-2 text-left ${typeStyle === t.id ? 'border-ink bg-white' : 'border-line'}`}>
                  <span className="block text-2xl leading-none" style={{ fontFamily: STYLE_FONT[t.id], fontWeight: t.weight, fontStyle: t.italic ? 'italic' : 'normal' }}>{t.upper ? 'GRACE' : 'Grace'}</span><span className="text-xs font-semibold text-muted">{t.name}</span></button>))}</div></fieldset>
          </>)}

          {tier === 'full_custom' && (<>
            <div><Label htmlFor="c-notes">Describe your idea</Label><textarea id="c-notes" rows={5} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What should it say or show? Mood, colours, style, who it is for…" className="w-full rounded-btn border border-line bg-white p-3 text-base" /><Err k="notes" /></div>
            <div><FileUploader bucket="custom" onPaths={setPaths} onPreview={setPreview} /><Err k="uploadPaths" />
              <p className="mt-2 text-xs text-muted">Only upload images you own or have permission to use. By uploading, you confirm you have the right to print them. Files are stored privately and used only for your order.</p>
              <label className="mt-2 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="size-5 accent-ink" />I have the right to use these images</label><Err k="rightsConfirmed" /></div>
          </>)}
        </section>
      </div>

      <aside className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start" aria-label="Live preview and summary">
        <div className="rounded-lg border-2 border-ink bg-white p-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted">Live preview</p>
          <div className="grid grid-cols-2 gap-3">{mock('front', showFront)}{mock('back', showBack)}</div>
          <p className="mt-2 text-xs text-muted">A guide to how it will look. Your proof shows the exact final layout.</p>
          <dl className="mt-4 space-y-1 border-t border-line pt-3">
            <div className="flex justify-between text-sm"><dt>{productType === 'tee' ? 'Oversized tee' : 'Hoodie'}</dt><dd>{formatNaira(basePrices[productType])}</dd></div>
            <div className="flex justify-between text-sm"><dt>{tierInfo.name} design fee</dt><dd>{formatNaira(tierInfo.feeKobo)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Total</dt><dd className="text-xl font-bold">{formatNaira(total)}</dd></div>
          </dl>
          <Button className="mt-4 w-full" onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Add to bag'}</Button>
          <div aria-live="polite" role="status">
            {result?.ok && <p className="mt-3 text-sm">{result.message} <Link href="/bag" className="font-semibold underline">View bag</Link>{result.demo && <span className="block text-xs text-muted">Demo mode: your brief was not saved to a database yet.</span>}</p>}
            {result && !result.ok && <p role="alert" className="mt-3 rounded-md bg-ember/10 p-3 text-sm">{result.message}</p>}
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-muted">
            <li><strong className="text-ink">Your proof arrives within {tierInfo.proofHours} hours</strong> of payment.</li>
            <li><strong className="text-ink">Production starts when you approve your proof</strong>, not when you pay.</li>
            <li>One free revision is included. More revisions can be added.</li>
            <li>Custom items are final sale, except for print defects. You will confirm this at checkout.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
