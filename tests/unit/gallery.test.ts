import { describe, expect, it } from 'vitest';
import { imagesForColour } from '@/lib/catalogue/gallery';

const im = (url: string, colour?: string | null) => ({ url, colour });
describe('imagesForColour', () => {
  const all = [im('shared-front'), im('black-front', 'Black'), im('white-front', 'White'), im('black-back', 'black')];
  it('shows the colour’s own photos first, then the shared ones (case-insensitive)', () => {
    expect(imagesForColour(all, 'Black').map((i) => i.url)).toEqual(['black-front', 'black-back', 'shared-front']);
    expect(imagesForColour(all, 'white').map((i) => i.url)).toEqual(['white-front', 'shared-front']);
  });
  it('falls back to every photo when nothing matches the colour', () => {
    expect(imagesForColour([im('a', 'Black'), im('b', 'White')], 'Sand').map((i) => i.url)).toEqual(['a', 'b']);
  });
  it('shows everything when no colour is chosen, and keeps products without colour photos unchanged', () => {
    expect(imagesForColour(all, null)).toHaveLength(4);
    expect(imagesForColour([im('x'), im('y')], 'Black').map((i) => i.url)).toEqual(['x', 'y']);
  });
});
