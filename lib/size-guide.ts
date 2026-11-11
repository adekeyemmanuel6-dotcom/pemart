// Garment measurements in cm (flat, across the chest and shoulder to hem).
// PLACEHOLDER VALUES: confirm with the print supplier's size chart before launch.
export const SIZE_GUIDE = {
  tee: {
    title: 'Oversized tee',
    note: 'Cut oversized with dropped shoulders. Take your usual size for the intended roomy fit, or size down for a closer one.',
    columns: ['Size', 'Chest width', 'Length', 'Sleeve'],
    rows: [['S', '58', '70', '22'], ['M', '61', '72', '23'], ['L', '64', '74', '24'], ['XL', '67', '76', '25'], ['XXL', '70', '78', '26']],
  },
  hoodie: {
    title: 'Hoodie',
    note: 'A roomy, heavyweight fit with a dropped shoulder. Size down if you prefer it closer to the body.',
    columns: ['Size', 'Chest width', 'Length', 'Sleeve'],
    rows: [['S', '60', '68', '58'], ['M', '63', '70', '60'], ['L', '66', '72', '62'], ['XL', '69', '74', '63'], ['XXL', '72', '76', '64']],
  },
  frame: {
    title: 'Frames',
    note: 'Outer frame size including the border.',
    columns: ['Size', 'Width', 'Height'],
    rows: [['A4', '24', '31'], ['A3', '33', '45']],
  },
} as const;

export type SizeGuideType = keyof typeof SIZE_GUIDE;
export const HOW_TO_MEASURE = [
  'Lay a garment you already love flat and measure it across the chest, from armpit to armpit.',
  'Compare that number with the chest width column. Pick the closest match.',
  'Between two sizes? Go up for a looser, more oversized feel. Go down for a neater fit.',
];
