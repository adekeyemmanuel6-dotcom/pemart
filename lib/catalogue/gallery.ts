/** Photos to show for the chosen colour: that colour's own photos first, then the shared ones (no colour). A colour with no photos shows everything. */
export function imagesForColour<T extends { colour?: string | null }>(images: T[], colour: string | null | undefined): T[] {
  if (!colour) return images;
  const same = (a?: string | null) => !!a && a.trim().toLowerCase() === colour.trim().toLowerCase();
  const own = images.filter((im) => same(im.colour));
  const shared = images.filter((im) => !im.colour);
  const picked = [...own, ...shared];
  return picked.length ? picked : images;
}
