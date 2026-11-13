'use client';
import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import type { AdminResult } from '@/lib/admin/types';

/** A form wired to a server action, with an accessible success/error message under it. */
export function ActionForm({ action, children, className, submitLabel, pendingLabel = 'Saving…', variant = 'primary', hideSubmit, resetOnSuccess, confirm }: {
  action: (prev: AdminResult, fd: FormData) => Promise<AdminResult>; children?: ReactNode; className?: string; submitLabel?: string; pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger'; hideSubmit?: boolean; resetOnSuccess?: boolean;
  /** Ask before submitting (for actions that remove or overwrite something). */
  confirm?: string;
}) {
  const last = useRef<FormData | null>(null);
  const [state, formAction, pending] = useActionState(async (p: AdminResult, fd: FormData) => { last.current = fd; return action(p, fd); }, null as AdminResult);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
    // React 19 clears a form after any action, even a failed one. Put the typed values back so a mistake does not cost the whole form.
    if (state && !state.ok && last.current && ref.current) {
      const form = ref.current, fd = last.current;
      window.setTimeout(() => {
        for (const el of Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]) {
          if (!el.name || el.type === 'hidden' || el.type === 'file' || el.type === 'submit' || el.tagName === 'BUTTON') continue;
          if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) el.checked = fd.getAll(el.name).map(String).includes(el.value || 'on');
          else if (fd.has(el.name)) el.value = String(fd.get(el.name));
        }
      }, 0);
    }
  }, [state, resetOnSuccess]);
  const btn = variant === 'primary' ? 'bg-ink text-paper hover:bg-ink/85' : variant === 'danger' ? 'bg-ember text-[#141414] hover:bg-ember/90' : 'border-2 border-ink text-ink hover:bg-ink hover:text-paper';
  return (
    <form ref={ref} action={formAction} className={className} onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}>
      {children}
      {!hideSubmit && <button type="submit" disabled={pending} className={`mt-3 inline-flex min-h-11 items-center justify-center rounded-btn px-5 text-sm font-semibold disabled:opacity-50 ${btn}`}>{pending ? pendingLabel : submitLabel ?? 'Save'}</button>}
      <div role="status" aria-live="polite" className="min-h-5">
        {state && <p className={`mt-2 text-sm ${state.ok ? 'font-semibold text-mocha' : 'text-ember'}`}>{state.message}{state.link && <> <a href={state.link} target="_blank" rel="noopener noreferrer" className="underline">{state.linkLabel ?? 'Open'}</a></>}</p>}
      </div>
    </form>
  );
}
