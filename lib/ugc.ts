/**
 * Customer photos for the home page wall. Add real, permissioned photos here
 * (or move to a database table later). The wall stays hidden until there are some,
 * so the site never shows invented social proof.
 */
export type UgcPhoto = { src: string; alt: string; handle: string };
export const UGC_PHOTOS: UgcPhoto[] = [];
