'use client';
import { useRef, useState } from 'react';
import { FileUp, Trash2 } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/env';
import { UPLOAD_RULES } from '@/lib/custom/tiers';

type Item = { id: string; name: string; status: 'uploading' | 'done' | 'demo' | 'error'; path?: string; message?: string };
const EXTS = ['png', 'jpg', 'jpeg', 'pdf', 'svg'];
const mime = (f: File) => (f.type === 'image/jpg' ? 'image/jpeg' : f.type || ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf', svg: 'image/svg+xml' } as Record<string, string>)[f.name.split('.').pop()?.toLowerCase() ?? ''] || '');

/** Uploads to a private bucket through one-time signed URLs. Reports uploaded paths (and the first image, for previews). */
export function FileUploader({ bucket, onPaths, onPreview, max = UPLOAD_RULES.maxFiles }: { bucket: 'custom' | 'bulk' | 'review'; onPaths: (paths: string[]) => void; onPreview?: (file: File | null) => void; max?: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const files = useRef<Map<string, File>>(new Map());
  const input = useRef<HTMLInputElement>(null);

  const emit = (next: Item[]) => { setItems(next); onPaths(next.filter((i) => i.path && (i.status === 'done' || i.status === 'demo')).map((i) => i.path!)); };

  async function upload(file: File, id: string): Promise<Item> {
    const base = { id, name: file.name };
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = bucket === 'review' ? ['png', 'jpg', 'jpeg'] : EXTS;
    if (!allowed.includes(ext) || !UPLOAD_RULES.types[mime(file)] || (bucket === 'review' && !mime(file).startsWith('image/'))) return { ...base, status: 'error', message: bucket === 'review' ? 'Use a PNG or JPG photo.' : 'Use PNG, JPG, PDF or SVG.' };
    if (file.size > UPLOAD_RULES.maxBytes) return { ...base, status: 'error', message: 'Over the 20MB limit.' };
    try {
      const res = await fetch('/api/uploads/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bucket, filename: file.name, contentType: mime(file), size: file.size }) });
      if (res.status === 503) return { ...base, status: 'demo', path: `demo/${file.name}`, message: 'Demo mode: not uploaded (storage is not connected yet).' };
      const j = await res.json();
      if (!res.ok) return { ...base, status: 'error', message: j.message ?? 'Upload failed.' };
      if (!isSupabaseConfigured) return { ...base, status: 'error', message: 'Storage is not configured.' };
      const { createClient } = await import('@/lib/supabase/client'); // loaded only when a file is uploaded
      const { error } = await createClient().storage.from(j.bucket).uploadToSignedUrl(j.path, j.token, file, { contentType: mime(file) });
      if (error) return { ...base, status: 'error', message: 'Upload failed. Please try again.' };
      return { ...base, status: 'done', path: j.path };
    } catch { return { ...base, status: 'error', message: 'Network problem. Please try again.' }; }
  }

  async function pick(list: FileList | null) {
    if (!list) return;
    const room = max - items.length;
    const chosen = [...list].slice(0, Math.max(0, room));
    const fresh = chosen.map((f) => { const id = crypto.randomUUID(); files.current.set(id, f); return { id, name: f.name, status: 'uploading' as const }; });
    let state = [...items, ...fresh]; setItems(state);
    const firstImage = chosen.find((f) => f.type.startsWith('image/'));
    if (firstImage) onPreview?.(firstImage);
    for (const it of fresh) {
      const result = await upload(files.current.get(it.id)!, it.id);
      state = state.map((x) => (x.id === it.id ? result : x));
      emit(state);
    }
    if (input.current) input.current.value = '';
  }

  const remove = (id: string) => { files.current.delete(id); emit(items.filter((i) => i.id !== id)); if (!items.some((i) => i.id !== id)) onPreview?.(null); };

  return (
    <div>
      <label className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line bg-white p-4 text-center hover:border-ink ${items.length >= max ? 'pointer-events-none opacity-50' : ''}`}>
        <FileUp className="size-6" aria-hidden />
        <span className="font-semibold">{bucket === 'review' ? 'Add photos (optional)' : 'Upload references or a sketch'}</span>
        <span className="text-sm text-muted">{bucket === 'review' ? `PNG or JPG, up to 20MB each (max ${max})` : `PNG, JPG, PDF or SVG, up to 20MB each (max ${max} files)`}</span>
        <input ref={input} type="file" multiple accept={bucket === 'review' ? '.png,.jpg,.jpeg,image/png,image/jpeg' : '.png,.jpg,.jpeg,.pdf,.svg,image/png,image/jpeg,application/pdf,image/svg+xml'} className="sr-only" onChange={(e) => pick(e.target.files)} />
      </label>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{i.name}</span>
              <span className={i.status === 'error' ? 'text-ember' : 'text-muted'}>{i.status === 'uploading' ? 'Uploading…' : i.status === 'done' ? 'Uploaded' : i.message}</span>
              <button type="button" onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`} className="grid size-9 place-items-center rounded hover:bg-sand"><Trash2 className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
