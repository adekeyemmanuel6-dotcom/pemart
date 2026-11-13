'use client';
import { useRef, useState } from 'react';
import { registerMedia } from '@/lib/admin/actions-media';

/** Upload one file for staff/admin. Puts the resulting path (proofs) or public URL (catalogue/logo) into a hidden input named `name`. */
export function AdminUploader({
  bucket,
  name,
  label,
  accept,
  onDone,
  initial,
}: {
  bucket: 'proofs' | 'catalogue';
  name?: string;
  label: string;
  accept: string;
  onDone?: (v: { url: string; path: string }) => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial ?? ''),
    [status, setStatus] = useState<string>(''),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setStatus('Uploading…');
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, filename: file.name, size: file.size }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.message ?? 'Upload not allowed.');
        return;
      }
      if (j.mode === 'dev') {
        const up = await fetch(j.uploadUrl, { method: 'PUT', body: file });
        if (!up.ok) {
          setStatus('Upload failed.');
          return;
        }
      } else {
        const { createClient } = await import('@/lib/supabase/client');
        const { error } = await createClient()
          .storage.from(j.bucket)
          .uploadToSignedUrl(j.path, j.token, file, { contentType: file.type });
        if (error) {
          setStatus('Upload failed.');
          return;
        }
      }
      const v = bucket === 'proofs' ? j.path : j.publicUrl;
      setValue(v);
      setStatus(`Uploaded: ${file.name}`);
      if (bucket === 'catalogue' && j.publicUrl) {
        // Add it to the media library so it can be reused (never blocks the upload).
        registerMedia({ url: j.publicUrl, path: j.path, filename: file.name.slice(0, 200), size: file.size, mime: file.type.slice(0, 80) }).catch(() => {});
      }
      onDone?.({ url: j.publicUrl ?? j.path, path: j.path });
    } catch {
      setStatus('Network problem. Please try again.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      {name && <input type="hidden" name={name} value={value} />}
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</label>
      <input
        ref={input}
        type="file"
        aria-label={label}
        accept={accept}
        disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])}
        className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-btn file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-paper"
      />
      {value && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setValue('');
            setStatus('Image removed. Save to publish this change.');
            onDone?.({ url: '', path: '' });
          }}
          className="min-h-11 text-sm underline"
        >
          Remove current image
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-sm text-muted">
        {status}
      </p>
    </div>
  );
}
