/** Garment colours used in the catalogue, with swatch hex and whether the print should be dark ink. */
export const GARMENT_COLOURS: Record<string, { hex: string; darkInk: boolean }> = {
  'Blue Jean': { hex: '#5f84b0', darkInk: false },
  Mocha: { hex: '#7a5a45', darkInk: false },
  Sand: { hex: '#e4d8c4', darkInk: true },
  Black: { hex: '#1b1b1b', darkInk: false },
  Navy: { hex: '#1f2a44', darkInk: false },
  White: { hex: '#f5f4ef', darkInk: true },
  'Royal Blue': { hex: '#1f4fb4', darkInk: false },
  'Army Green': { hex: '#4b5320', darkInk: false },
  Yellow: { hex: '#f2c230', darkInk: true },
  'Navy Blue': { hex: '#1f2a44', darkInk: false },
  Pink: { hex: '#e8a0b8', darkInk: true },
  Brown: { hex: '#6b4423', darkInk: false },
};

export const colourHex = (name: string) => GARMENT_COLOURS[name]?.hex ?? '#cfc0a6';
export const colourNeedsDarkInk = (name: string) => GARMENT_COLOURS[name]?.darkInk ?? false;
