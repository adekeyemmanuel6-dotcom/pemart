'use client';
import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { selectBagCount, useBag } from '@/lib/cart-store';

export function BagButton() {
  const count = useBag(selectBagCount);
  const setOpen = useBag((s) => s.setOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // localStorage is client-only; avoids a hydration mismatch
  const shown = mounted ? count : 0;
  return (
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="relative grid size-12 place-items-center rounded-btn hover:bg-sand" aria-label={`Bag, ${shown} ${shown === 1 ? 'item' : 'items'}`}>
      <ShoppingBag className="size-6" aria-hidden />
      {shown > 0 && (
        <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-xs font-bold leading-5 text-paper">{shown}</span>
      )}
    </button>
  );
}
