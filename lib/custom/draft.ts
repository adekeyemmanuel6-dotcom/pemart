import type { TierId, TypeStyleId } from './tiers';
import { TYPE_STYLES } from './tiers';

/** What the live preview needs. Also used to render a stored request in admin (Phase 6). */
export type PrintDraft = {
  tier: TierId;
  designSlug?: string;
  name?: string; date?: string; verse?: string;
  textLines: string[];
  typeStyle?: TypeStyleId;
  uploadUrl?: string | null;  // object URL of an uploaded image, for the preview only
};

/**
 * Font sizes (in cqw, % of the print area's width) that fit each line inside the area.
 * Back area is 5:6 (height = 120cqw); the front chest area is 2:1 (height = 50cqw), where only the first line is shown.
 */
export function fitLines(lines: string[], styleId: TypeStyleId | undefined, view: 'front' | 'back'): { text: string; size: number }[] {
  const style = TYPE_STYLES.find((t) => t.id === styleId) ?? TYPE_STYLES[0];
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const use = view === 'front' ? clean.slice(0, 1) : clean;
  const maxSize = view === 'front' ? 30 : use.length <= 2 ? 36 : 28;
  const sized = use.map((text) => {
    const len = Math.max(text.length, 3);
    return { text: style.upper ? text.toUpperCase() : text, size: Math.min(maxSize, 92 / (len * style.charW)) };
  });
  const lineHeight = 1.06;
  const budget = view === 'front' ? 44 : 112;
  const used = sized.reduce((a, s) => a + s.size * lineHeight, 0);
  const k = used > budget ? budget / used : 1;
  return sized.map((s) => ({ ...s, size: Math.max(3, s.size * k) }));
}
