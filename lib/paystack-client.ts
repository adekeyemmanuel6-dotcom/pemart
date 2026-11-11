'use client';

/** Opens Paystack's inline popup for a transaction the SERVER already created (we pass its access code, never an amount). */
declare global { interface Window { PaystackPop?: new () => { resumeTransaction: (accessCode: string, cb: { onSuccess: (t: { reference: string }) => void; onCancel: () => void; onError: (e: { message: string }) => void }) => void } } }

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  return (loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v2/inline.js'; s.async = true;
    s.onload = () => resolve(); s.onerror = () => { loading = null; reject(new Error('Could not load Paystack')); };
    document.head.appendChild(s);
  }));
}

export async function openPaystack(accessCode: string, h: { onSuccess: (reference: string) => void; onCancel: () => void; onError: (message: string) => void }) {
  try {
    await loadScript();
    new window.PaystackPop!().resumeTransaction(accessCode, { onSuccess: (t) => h.onSuccess(t.reference), onCancel: h.onCancel, onError: (e) => h.onError(e.message) });
  } catch (e) { h.onError((e as Error).message); }
}
