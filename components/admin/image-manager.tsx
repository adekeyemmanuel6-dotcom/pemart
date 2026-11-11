'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { ActionForm } from './action-form';
import { AdminUploader } from './admin-uploader';
import { inputCls } from './ui';
import { saveImagesAction } from '@/lib/admin/actions-admin';

type Img = { id?: string; url: string; alt: string; view: 'front' | 'back' | 'model' | 'detail' };

/** Product photos: upload, reorder with the arrows, write alt text, remove. The first image is the main one. */
export function ImageManager({ productId, initial }: { productId: string; initial: Img[] }) {
  const [imgs, setImgs] = useState<Img[]>(initial);
  const move = (i: number, d: number) => setImgs((a) => { const n = [...a]; const j = i + d; if (j < 0 || j >= n.length) return a; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const set = (i: number, p: Partial<Img>) => setImgs((a) => a.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <ActionForm action={saveImagesAction} submitLabel="Save images">
      <input type="hidden" name="productId" value={productId} /><input type="hidden" name="images" value={JSON.stringify(imgs)} />
      <ul className="space-y-3">{imgs.map((im, i) => (
        <li key={`${im.url}-${i}`} className="flex flex-wrap items-start gap-3 rounded-md border border-line p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={im.url} alt="" className="size-20 rounded object-cover" />
          <div className="grid min-w-48 flex-1 gap-2 sm:grid-cols-[1fr_8rem]">
            <div><label className="sr-only" htmlFor={`alt-${i}`}>Alt text for image {i + 1}</label><input id={`alt-${i}`} value={im.alt} onChange={(e) => set(i, { alt: e.target.value })} placeholder="Describe the photo (alt text)" className={inputCls} /></div>
            <div><label className="sr-only" htmlFor={`view-${i}`}>View for image {i + 1}</label><select id={`view-${i}`} value={im.view} onChange={(e) => set(i, { view: e.target.value as Img['view'] })} className={inputCls}>{['front', 'back', 'model', 'detail'].map((v) => (<option key={v}>{v}</option>))}</select></div>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move image ${i + 1} up`} className="grid size-11 place-items-center rounded border border-line disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === imgs.length - 1} aria-label={`Move image ${i + 1} down`} className="grid size-11 place-items-center rounded border border-line disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
            <button type="button" onClick={() => setImgs((a) => a.filter((_, k) => k !== i))} aria-label={`Remove image ${i + 1}`} className="grid size-11 place-items-center rounded border border-line"><Trash2 className="size-4" aria-hidden /></button>
          </div>
        </li>))}</ul>
      <div className="mt-3 max-w-sm"><AdminUploader bucket="catalogue" label="Add a photo" accept=".png,.jpg,.jpeg,.webp" onDone={({ url }) => setImgs((a) => [...a, { url, alt: '', view: 'front' }])} /></div>
    </ActionForm>
  );
}
