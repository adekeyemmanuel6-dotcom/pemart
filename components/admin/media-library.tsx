'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Check, Copy, Search, Trash2, X } from 'lucide-react';
import { deleteMedia, listMedia, updateMediaAlt, type MediaItem } from '@/lib/admin/actions-media';
import { AdminUploader } from './admin-uploader';
import { inputCls } from './ui';

const kb = (n: number | null) => (n ? (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`) : '');

function AltEditor({ item, onSaved }: { item: MediaItem; onSaved: (alt: string) => void }) {
  const [alt, setAlt] = useState(item.alt);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  return (
    <form className="mt-2 flex gap-1" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateMediaAlt(item.id, alt); setMsg(r.message); if (r.ok) onSaved(alt); }); }}>
      <label className="sr-only" htmlFor={`alt-${item.id}`}>Description for {item.filename}</label>
      <input id={`alt-${item.id}`} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} placeholder="Describe the image" className={`${inputCls} min-h-9 text-sm`} />
      <button type="submit" disabled={pending || alt === item.alt} className="min-h-9 rounded border px-2 text-xs disabled:opacity-40">Save</button>
      <span role="status" className="sr-only">{msg}</span>
    </form>
  );
}

/**
 * The media library: every uploaded image, with search, descriptions (alt text), where it is used and safe delete.
 * In picker mode, clicking an image chooses it.
 */
export function MediaLibrary({ onPick }: { onPick?: (item: MediaItem) => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async (query: string, offset = 0) => {
    setLoading(true);
    try {
      const r = await listMedia(query, offset, !onPick);
      if ('missing' in r) { setMissing(true); return; }
      setTotal(r.total);
      setItems((prev) => (offset ? [...prev, ...r.items] : r.items));
    } catch { setMessage('Could not load the library.'); }
    finally { setLoading(false); }
  }, [onPick]);

  useEffect(() => { load(''); }, [load]);
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => load(q), 300);
    return () => window.clearTimeout(timer.current);
  }, [q, load]);

  if (missing) return <p className="rounded-lg border border-mocha bg-mocha/15 p-4 text-sm">The media library becomes available once <code>supabase/migrations/0020_media_library.sql</code> has been applied. Uploading images still works everywhere.</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_320px] md:items-end">
        <label className="relative block">
          <span className="sr-only">Search images</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name or description" className={`${inputCls} pl-9`} />
        </label>
        <AdminUploader bucket="catalogue" label="Upload a new image" accept=".jpg,.jpeg,.png,.webp" onDone={(v) => { if (v.url) window.setTimeout(() => load(q), 400); }} />
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">{loading ? 'Loading…' : message || `${total} image${total === 1 ? '' : 's'}`}</p>
      <ul className={`grid gap-4 ${onPick ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}`}>
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border border-line p-2">
            {onPick ? (
              <button type="button" onClick={() => onPick(m)} className="block w-full text-left" aria-label={`Use ${m.alt || m.filename}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" loading="lazy" className="aspect-square w-full rounded bg-white object-contain" />
                <span className="mt-1 block truncate text-xs">{m.filename}</span>
              </button>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} loading="lazy" className="aspect-square w-full rounded bg-white object-contain" />
                <p className="mt-2 truncate text-sm font-semibold" title={m.filename}>{m.filename || 'Image'}</p>
                <p className="text-xs text-muted">{[kb(m.size_bytes), m.uploaded_by].filter(Boolean).join(' · ') || ' '}</p>
                <AltEditor item={m} onSaved={(alt) => setItems((xs) => xs.map((x) => (x.id === m.id ? { ...x, alt } : x)))} />
                <p className="mt-2 text-xs">{m.used?.length ? <>Used in: {m.used.map((u, i) => <a key={i} href={u.href} className="underline">{u.label}{i < m.used!.length - 1 ? ', ' : ''}</a>)}</> : <span className="text-muted">Not used anywhere</span>}</p>
                <div className="mt-2 flex gap-1">
                  <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded border px-2 text-xs"
                    onClick={async () => { try { await navigator.clipboard.writeText(m.url); setCopied(m.id); setTimeout(() => setCopied(null), 1500); } catch { setMessage(m.url); } }}>
                    {copied === m.id ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}{copied === m.id ? 'Copied' : 'Copy link'}
                  </button>
                  <button type="button" disabled={!!m.used?.length} title={m.used?.length ? 'Replace it where it is used first' : undefined}
                    className="inline-flex min-h-9 items-center gap-1 rounded border px-2 text-xs text-ember disabled:opacity-30"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${m.filename || 'this image'}? This cannot be undone.`)) return;
                      const r = await deleteMedia(m.id); setMessage(r.message);
                      if (r.ok) { setItems((xs) => xs.filter((x) => x.id !== m.id)); setTotal((t) => t - 1); }
                    }}>
                    <Trash2 className="size-3.5" aria-hidden />Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {items.length < total && <button type="button" disabled={loading} onClick={() => load(q, items.length)} className="min-h-11 rounded border px-4 text-sm">Show more</button>}
    </div>
  );
}

/** "Choose from library" button + dialog, used next to every image field in the editors. */
export function MediaPickerButton({ onPick }: { onPick: (url: string, alt: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="min-h-11 rounded border px-3 text-sm" onClick={() => { setOpen(true); ref.current?.showModal(); }}>Choose from library</button>
      <dialog ref={ref} onClose={() => setOpen(false)} className="admin-theme m-auto w-[min(960px,calc(100vw-32px))] rounded-lg border border-line bg-paper p-0 text-ink backdrop:bg-black/60" aria-label="Media library">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-lg font-semibold">Media library</h2>
          <button type="button" className="grid size-11 place-items-center" aria-label="Close" onClick={() => ref.current?.close()}><X className="size-5" aria-hidden /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {open && <MediaLibrary onPick={(m) => { onPick(m.url, m.alt); ref.current?.close(); }} />}
        </div>
      </dialog>
    </>
  );
}
