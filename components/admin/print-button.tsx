'use client';
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="min-h-11 rounded bg-black px-5 text-sm font-semibold text-white">Print</button>;
}
