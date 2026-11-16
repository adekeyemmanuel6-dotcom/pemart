'use client';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AdminUploader } from './admin-uploader';
import { inputCls, labelCls } from './ui';

export type PresaleImage = { url: string; alt: string };
export const MAX_PRESALE_IMAGES = 10;

/** Carousel pictures for the pre-sale poster: upload up to 10, reorder, describe, remove. Sent to the server as JSON in a hidden field. */
export function PresaleImages({ initial }: { initial: PresaleImage[] }) {
  const [items, setItems] = useState<PresaleImage[]>(initial);
  const [uploaderKey, setUploaderKey] = useState(0);
  const move = (i: number, d: number) => setItems((a) => { const n = [...a]; const j = i + d; if (j < 0 || j >= n.length) return a; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const full = items.length >= MAX_PRESALE_IMAGES;
  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(items)} />
      <p className={labelCls}>Poster pictures ({items.length} of {MAX_PRESALE_IMAGES})</p>
      {items.length > 0 && (
        <ol className="mb-3 space-y-2">
          {items.map((im, i) => (
            <li key={im.url + i} className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="h-20 w-16 rounded object-cover" />
              <div className="min-w-[12rem] flex-1">
                <label className="sr-only" htmlFor={`pi-alt-${i}`}>Description of picture {i + 1} (optional)</label>
                <input id={`pi-alt-${i}`} value={im.alt} placeholder={`Picture ${i + 1}: short description (optional)`} onChange={(e) => setItems((a) => a.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))} className={inputCls} />
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move picture ${i + 1} earlier`} className="grid size-11 place-items-center rounded border border-line hover:bg-sand disabled:opacity-40"><ArrowUp className="size-4" aria-hidden /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move picture ${i + 1} later`} className="grid size-11 place-items-center rounded border border-line hover:bg-sand disabled:opacity-40"><ArrowDown className="size-4" aria-hidden /></button>
                <button type="button" onClick={() => setItems((a) => a.filter((_, k) => k !== i))} aria-label={`Remove picture ${i + 1}`} className="grid size-11 place-items-center rounded border border-line hover:bg-sand"><Trash2 className="size-4" aria-hidden /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {full ? <p className="text-sm text-muted">That is the maximum. Remove one to add another.</p> : (
        <AdminUploader key={uploaderKey} bucket="catalogue" label="Add a picture (portrait 4:5 looks best)" accept=".png,.jpg,.jpeg,.webp"
          onDone={(v) => { if (v.url) { setItems((a) => (a.length >= MAX_PRESALE_IMAGES ? a : [...a, { url: v.url, alt: '' }])); setUploaderKey((k) => k + 1); } }} />
      )}
      <p className="mt-1 text-xs text-muted">Visitors swipe or tap through them in this order. One picture shows without arrows.</p>
    </div>
  );
}
