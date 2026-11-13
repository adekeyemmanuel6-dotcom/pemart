import { getImageProps } from 'next/image';

/**
 * One image with a different crop per device: desktop (≥1280px), laptop (768–1279px) and phone (<768px).
 * Missing sizes fall back to the nearest one supplied, so a single desktop image is enough.
 */
export function ArtPicture({
  desktop,
  laptop,
  phone,
  alt,
  priority = false,
  className = 'absolute inset-0 size-full object-cover',
}: {
  desktop: string;
  laptop: string;
  phone: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const d = desktop || laptop || phone;
  const l = laptop || desktop || phone;
  const p = phone || laptop || desktop;
  if (!d) return null;
  const common = { alt, sizes: '100vw', quality: 80, priority };
  const dSet = getImageProps({ ...common, src: d, width: 1920, height: 800 }).props.srcSet;
  const lSet = getImageProps({ ...common, src: l, width: 1440, height: 720 }).props.srcSet;
  const { srcSet: pSet, ...rest } = getImageProps({ ...common, src: p, width: 1080, height: 1350 }).props;
  return (
    <picture>
      <source media="(min-width: 1280px)" srcSet={dSet} />
      <source media="(min-width: 768px)" srcSet={lSet} />
      <img {...rest} alt={alt} srcSet={pSet} className={className} />
    </picture>
  );
}
