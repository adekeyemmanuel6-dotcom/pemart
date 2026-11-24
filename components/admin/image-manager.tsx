'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { ActionForm } from './action-form';
import { AdminUploader } from './admin-uploader';
import { inputCls } from './ui';
import { saveImagesAction } from '@/lib/admin/actions-admin';

type Img = { id?: string; url: string; alt: string; view: 'front' | 'back' | 'model' | 'detail'; colour?: string | null };

/** Product photos: upload, reorder with the arrows, write alt text, remove. The first image is the main one. */
export function ImageManager({ productId, initial, colours = [] }: { productId: string; initial: Img[]; colours?: string[] }) {
  const [imgs, setImgs] = useState<Img[]>(initial);
  const set = (i: number, p: Partial<Img>) => setImgs((a) => a.map((x, k) => (k === i ? { ...x, ...p } : x)));
  // Moving a photo swaps it with its neighbour in the SAME section (all-colours or one colour); the saved order is the overall order.
  const move = (i: number, d: number) => setImgs((a) => {
    const key = a[i]!.colour ?? '';
    const mates = a.map((x, k) => ({ x, k })).filter(({ x }) => (x.colour ?? '') === key).map(({ k }) => k);
    const pos = mates.indexOf(i), j = mates[pos + d];
    if (j === undefined) return a;
    const n = [...a]; [n[i], n[j]] = [n[j]!, n[i]!]; return n;
  });
  const sections: { key: string; title: string; hint: string }[] = colours.length
    ? [{ key: '', title: 'All colours', hint: 'Shown whatever colour the customer picks (for example a close-up of the print).' }, ...colours.map((c) => ({ key: c, title: c, hint: `Shown when the customer picks ${c}. They are shown first, then the "All colours" photos.` }))]
    : [{ key: '', title: 'Photos', hint: '' }];
  const known = new Set(colours);
  return (
    <ActionForm action={saveImagesAction} submitLabel="Save images">
      <input type="hidden" name="productId" value={productId} /><input type="hidden" name="images" value={JSON.stringify(imgs)} />
      {colours.length > 0 && <p className="mb-3 text-sm text-muted">Add the photos for each colour in its own section below. When a customer picks a colour, the photos change to that colour&apos;s photos.</p>}
      <div className="space-y-5">
        {sections.map((sec) => {
          const mine = imgs.map((im, i) => ({ im, i })).filter(({ im }) => (im.colour && known.has(im.colour) ? im.colour : '') === sec.key);
          return (
            <section key={sec.key || 'all'} aria-label={`${sec.title} photos`} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold">{sec.title} <span className="text-sm font-normal text-muted">({mine.length} {mine.length === 1 ? 'photo' : 'photos'})</span></h3>
                {sec.key && mine.length === 0 && <p className="text-xs text-ember">No photo yet: customers see the &ldquo;All colours&rdquo; photos.</p>}
              </div>
              {sec.hint && <p className="mb-2 text-xs text-muted">{sec.hint}</p>}
              <ul className="space-y-3">{mine.map(({ im, i }, pos) => (
                <li key={`${im.url}-${i}`} className="flex flex-wrap items-start gap-3 rounded-md border border-line p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" className="size-20 rounded object-cover" />
                  <div className={`grid min-w-48 flex-1 gap-2 ${colours.length ? 'sm:grid-cols-[1fr_8rem_9rem]' : 'sm:grid-cols-[1fr_8rem]'}`}>
                    <div><label className="sr-only" htmlFor={`alt-${i}`}>Alt text for image {i + 1}</label><input id={`alt-${i}`} value={im.alt} onChange={(e) => set(i, { alt: e.target.value })} placeholder="Describe the photo (alt text)" className={inputCls} /></div>
                    <div><label className="sr-only" htmlFor={`view-${i}`}>View for image {i + 1}</label><select id={`view-${i}`} value={im.view} onChange={(e) => set(i, { view: e.target.value as Img['view'] })} className={inputCls}>{['front', 'back', 'model', 'detail'].map((v) => (<option key={v}>{v}</option>))}</select></div>
                    {colours.length > 0 && (<div><label className="sr-only" htmlFor={`colour-${i}`}>Colour for image {i + 1}</label><select id={`colour-${i}`} value={im.colour ?? ''} onChange={(e) => set(i, { colour: e.target.value || null })} className={inputCls}><option value="">All colours</option>{colours.map((c) => (<option key={c} value={c}>{c} only</option>))}</select></div>)}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={pos === 0} aria-label={`Move image ${i + 1} up`} className="grid size-11 place-items-center rounded border border-line disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={pos === mine.length - 1} aria-label={`Move image ${i + 1} down`} className="grid size-11 place-items-center rounded border border-line disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
                    <button type="button" onClick={() => setImgs((a) => a.filter((_, k) => k !== i))} aria-label={`Remove image ${i + 1}`} className="grid size-11 place-items-center rounded border border-line"><Trash2 className="size-4" aria-hidden /></button>
                  </div>
                </li>))}</ul>
              <div className="mt-2 max-w-sm"><AdminUploader bucket="catalogue" label={colours.length ? `Add a photo for ${sec.key ? sec.title : 'all colours'}` : 'Add a photo'} accept=".png,.jpg,.jpeg,.webp" onDone={({ url }) => setImgs((a) => [...a, { url, alt: '', view: 'front', colour: sec.key || null }])} /></div>
            </section>
          );
        })}
      </div>
    </ActionForm>
  );
}
