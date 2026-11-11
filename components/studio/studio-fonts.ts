import { Bebas_Neue, Permanent_Marker, Playfair_Display, Space_Mono } from 'next/font/google';
import type { TypeStyleId } from '@/lib/custom/tiers';

// Loaded only on /custom (this module is imported by the studio alone).
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], display: 'swap' });
const playfair = Playfair_Display({ weight: '800', style: 'italic', subsets: ['latin'], display: 'swap' });
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], display: 'swap' });
const mono = Space_Mono({ weight: '700', subsets: ['latin'], display: 'swap' });

export const STYLE_FONT: Record<TypeStyleId, string> = {
  heavy: 'var(--font-anton), Impact, sans-serif',
  bebas: bebas.style.fontFamily,
  serif: playfair.style.fontFamily,
  script: 'var(--font-caveat), cursive',
  marker: marker.style.fontFamily,
  mono: mono.style.fontFamily,
};
