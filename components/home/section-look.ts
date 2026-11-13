import type { CSSProperties } from 'react';
import { DEFAULT_SECTION_STYLE, type SectionStyle, type WebsiteSection } from '@/lib/website/schema';

const HEADING_FONT: Record<Exclude<SectionStyle['headingFont'], 'default'>, string> = {
  display: "var(--font-anton), 'Bebas Neue', Impact, 'Arial Narrow', sans-serif",
  sans: "'Naira', Arial, Helvetica, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
};
const BODY_FONT: Record<Exclude<SectionStyle['bodyFont'], 'default'>, string> = {
  sans: "'Naira', Arial, Helvetica, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
};

/** Sections that are dark in the built-in design (their "default" background is black). */
export const DARK_BY_DEFAULT = new Set<WebsiteSection['id']>(['philosophy', 'bulk']);
/** Sections that are centred in the built-in design. */
const CENTRED_BY_DEFAULT = new Set<WebsiteSection['id']>(['newsletter']);

/**
 * Turns a section's chosen look (fonts, case, size, background, alignment, spacing) into classes and CSS
 * variables on the section wrapper. "default" keeps the built-in design, so untouched sections render as before.
 */
export function sectionLook(s: WebsiteSection): { className: string; style: CSSProperties; dark: boolean; align: 'left' | 'center' } {
  const st = { ...DEFAULT_SECTION_STYLE, ...s.style };
  const bg = st.background === 'default' ? (DARK_BY_DEFAULT.has(s.id) ? 'black' : 'default') : st.background;
  const align = st.align === 'default' ? (CENTRED_BY_DEFAULT.has(s.id) ? 'center' : 'left') : st.align;
  const cls = [
    'ws',
    bg !== 'default' && `ws-bg-${bg}`,
    `ws-align-${align}`,
    st.spacing !== 'default' && `ws-space-${st.spacing}`,
    st.headingCase !== 'default' && `ws-case-${st.headingCase}`,
    st.headingSize !== 'default' && `ws-size-${st.headingSize}`,
  ].filter(Boolean);
  const style: Record<string, string> = {};
  if (st.headingFont !== 'default') style['--font-display'] = HEADING_FONT[st.headingFont];
  if (st.bodyFont !== 'default') style.fontFamily = BODY_FONT[st.bodyFont];
  return { className: cls.join(' '), style: style as CSSProperties, dark: bg === 'black', align };
}
