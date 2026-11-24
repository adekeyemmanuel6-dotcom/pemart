/**
 * Fonts the owner can choose for headings and for paragraphs (Website editor → Brand & SEO).
 * The font files are bundled with the site (assets/fonts/choices, all open-licence), so choosing one adds no external request and
 * a visitor only downloads the font actually in use. "default" keeps the original look.
 * The ₦ sign comes first in every stack: it is served by a system font, because most web fonts lack it.
 */
export const FONT_IDS = ['default', 'anton', 'bebas', 'oswald', 'montserrat', 'poppins', 'playfair', 'lora', 'inter', 'dmsans', 'georgia', 'arial'] as const;
export type FontId = (typeof FONT_IDS)[number];

type Choice = { label: string; stack: string; heading: boolean; body: boolean; note: string };
const NAIRA = "'Naira'";
export const FONT_CHOICES: Record<Exclude<FontId, 'default'>, Choice> = {
  anton: { label: 'Anton', note: 'Bold, tall and condensed (the original heading look)', heading: true, body: false, stack: `${NAIRA}, var(--font-anton), 'Bebas Neue', Impact, 'Arial Narrow', sans-serif` },
  bebas: { label: 'Bebas Neue', note: 'Clean capitals, a little lighter than Anton', heading: true, body: false, stack: `${NAIRA}, var(--font-bebas), Impact, 'Arial Narrow', sans-serif` },
  oswald: { label: 'Oswald', note: 'Strong and modern, easy to read', heading: true, body: true, stack: `${NAIRA}, var(--font-oswald), 'Arial Narrow', sans-serif` },
  montserrat: { label: 'Montserrat', note: 'Geometric and friendly', heading: true, body: true, stack: `${NAIRA}, var(--font-montserrat), Arial, sans-serif` },
  poppins: { label: 'Poppins', note: 'Round, modern and clear', heading: true, body: true, stack: `${NAIRA}, var(--font-poppins), Arial, sans-serif` },
  playfair: { label: 'Playfair Display', note: 'Elegant serif for headings', heading: true, body: false, stack: `${NAIRA}, var(--font-playfair), Georgia, serif` },
  lora: { label: 'Lora', note: 'Warm, readable serif', heading: true, body: true, stack: `${NAIRA}, var(--font-lora), Georgia, serif` },
  inter: { label: 'Inter', note: 'Neutral and very readable', heading: false, body: true, stack: `${NAIRA}, var(--font-inter-choice), Arial, sans-serif` },
  dmsans: { label: 'DM Sans', note: 'Soft, contemporary sans', heading: false, body: true, stack: `${NAIRA}, var(--font-dmsans), Arial, sans-serif` },
  georgia: { label: 'Georgia', note: 'Classic serif already on every device', heading: true, body: true, stack: `${NAIRA}, Georgia, 'Times New Roman', serif` },
  arial: { label: 'Arial', note: 'Plain sans already on every device', heading: true, body: true, stack: `${NAIRA}, Arial, Helvetica, sans-serif` },
};

export const headingFontIds = FONT_IDS.filter((id) => id === 'default' || FONT_CHOICES[id as keyof typeof FONT_CHOICES].heading);
export const bodyFontIds = FONT_IDS.filter((id) => id === 'default' || FONT_CHOICES[id as keyof typeof FONT_CHOICES].body);
/** The CSS font stack for a choice, or null for "default" (leave the site's own look alone). */
export const fontStack = (id: string | undefined): string | null => (id && id !== 'default' && id in FONT_CHOICES ? FONT_CHOICES[id as keyof typeof FONT_CHOICES].stack : null);
