/** Garment colours used in the catalogue, with swatch hex and whether the print should be dark ink. */
export const GARMENT_COLOURS: Record<string, { hex: string; darkInk: boolean }> = {
  'Blue Jean': { hex: '#5f84b0', darkInk: false },
  Mocha: { hex: '#7a5a45', darkInk: false },
  Sand: { hex: '#e4d8c4', darkInk: true },
  Black: { hex: '#1b1b1b', darkInk: false },
  Navy: { hex: '#1f2a44', darkInk: false },
};

export const colourHex = (name: string) => GARMENT_COLOURS[name]?.hex ?? '#cfc0a6';
export const colourNeedsDarkInk = (name: string) => GARMENT_COLOURS[name]?.darkInk ?? false;
