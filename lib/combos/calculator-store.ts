'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ComboSelection } from './types';

/**
 * Calculator UI state. The unfinished selection (draft) is kept in sessionStorage, so closing the dialog, moving between pages or
 * refreshing does not lose it, but it is not kept across browser sessions. Prices are never stored.
 */
type CalcState = {
  open: boolean;
  slug: string | null;
  /** When editing a combo already in the bag, its line id: adding replaces that line. */
  editingLineId: string | null;
  drafts: Record<string, ComboSelection>;
  show: (slug?: string | null, edit?: { lineId: string; selection: ComboSelection }) => void;
  close: () => void;
  select: (slug: string) => void;
  setDraft: (slug: string, sel: ComboSelection) => void;
  clearDraft: (slug: string) => void;
};

/** The element that opened the dialog, so focus can go back to it on close (Radix only does that for its own Trigger). */
export const opener: { el: HTMLElement | null } = { el: null };

export const useCalculator = create<CalcState>()(
  persist(
    (set) => ({
      open: false, slug: null, editingLineId: null, drafts: {},
      show: (slug, edit) => { opener.el = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null; set((s) => ({
        open: true, slug: slug ?? edit?.selection.collection ?? s.slug, editingLineId: edit?.lineId ?? null,
        drafts: edit ? { ...s.drafts, [edit.selection.collection]: edit.selection } : s.drafts,
      })); },
      close: () => set({ open: false, editingLineId: null }),
      select: (slug) => set({ slug }),
      setDraft: (slug, sel) => set((s) => ({ drafts: { ...s.drafts, [slug]: sel } })),
      clearDraft: (slug) => set((s) => { const { [slug]: _, ...rest } = s.drafts; void _; return { drafts: rest }; }),
    }),
    { name: 'pemart-combo-draft', storage: createJSONStorage(() => sessionStorage), partialize: (s) => ({ drafts: s.drafts, slug: s.slug }) },
  ),
);
