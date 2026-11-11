'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Phase 1 skeleton of the bag. The client stores only WHAT was chosen (ids,
 * options, quantity). Prices are never stored here as a source of truth: the
 * server re-prices every line from the database at checkout (Phase 4).
 */
export type BagLine = {
  id: string;
  kind: 'variant' | 'bundle' | 'custom';
  refId: string; // variant id, bundle slug, or custom request id
  quantity: number;
  /** bundle: a BundleSelection. custom: { request, persisted, summary }. Never trusted for pricing. */
  selection?: Record<string, unknown>;
  giftMessage?: string;
  giftWrap?: boolean;
};

type BagState = {
  lines: BagLine[];
  isOpen: boolean;
  add: (line: BagLine) => void;
  remove: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
};

export const useBag = create<BagState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      add: (line) =>
        set((s) => {
          // Identical plain variants merge into one line; bundles and custom selections stay separate.
          const match = line.kind === 'variant' && !line.selection && !line.giftMessage
            ? s.lines.find((l) => l.kind === 'variant' && l.refId === line.refId && !l.selection && !l.giftMessage)
            : undefined;
          if (match) return { lines: s.lines.map((l) => (l === match ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l)), isOpen: true };
          return { lines: [...s.lines, line], isOpen: true };
        }),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      setQuantity: (id, quantity) =>
        set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, quantity: Math.max(1, Math.min(20, quantity)) } : l)) })),
      clear: () => set({ lines: [] }),
      setOpen: (isOpen) => set({ isOpen }),
    }),
    { name: 'pemart-bag', partialize: (s) => ({ lines: s.lines }) },
  ),
);

export const selectBagCount = (s: BagState) => s.lines.reduce((n, l) => n + l.quantity, 0);
