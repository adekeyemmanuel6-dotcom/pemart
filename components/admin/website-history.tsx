'use client';
import { useState, useTransition } from 'react';
import { restoreWebsiteAction } from '@/lib/admin/actions-control';
import { fmtDate } from './ui';

export type Revision = { id: number; revision: number; created_at: string; author: string | null; restored_from: number | null; size: number };

/** Published versions of the website, newest first, with one-click restore. */
export function WebsiteHistory({ history, revision }: { history: Revision[]; revision: number }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);

  const restore = (r: Revision) => {
    if (!window.confirm(`Make version ${r.revision} (${fmtDate(r.created_at, true)}) live again? The current version stays in this history, so you can switch back.`)) return;
    setBusy(r.id);
    start(async () => {
      const res = await restoreWebsiteAction(r.id, revision);
      setMessage({ ok: res.ok, text: res.message });
      setBusy(null);
      if (res.ok) window.setTimeout(() => window.location.reload(), 900);
    });
  };

  return (
    <section aria-labelledby="history-h" className="rounded-lg border border-line p-4">
      <h2 id="history-h" className="display text-2xl">Version history</h2>
      <p className="mt-1 text-sm text-muted">Every publish is saved. Restoring publishes that version again as a new version; nothing is deleted.</p>
      <p role="status" aria-live="polite" className={`mt-2 min-h-5 text-sm ${message?.ok ? 'font-semibold text-mocha' : 'text-ember'}`}>{message?.text}</p>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No versions yet. Your first publish will appear here.</p>
      ) : (
        <ol className="mt-2 divide-y divide-line">
          {history.map((h) => {
            const live = h.revision === revision;
            return (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <strong>Version {h.revision}</strong>{live && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-paper">Live</span>}
                  <span className="block text-muted">{fmtDate(h.created_at, true)} · {h.author ?? 'unknown'}{h.restored_from ? ` · restored from version ${h.restored_from}` : ''}</span>
                </span>
                {!live && (
                  <button type="button" disabled={pending} onClick={() => restore(h)} className="min-h-11 rounded-btn border border-line px-4 font-semibold disabled:opacity-50">
                    {busy === h.id ? 'Restoring…' : 'Restore'}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
