import Image from 'next/image';
import Link from 'next/link';

export const DEFAULT_LOGO = { light: '/brand/wear-the-word-logo-black.png', dark: '/brand/wear-the-word-logo-white.png' } as const;

/**
 * The brand logo. `on` is the background it sits on: the black logo on light backgrounds, the white one on dark.
 * Either can be replaced in Website editor → Brand; the built-in Wear The Word logos are the default.
 */
export function Logo({
  on = 'light',
  src,
  name = 'Wear The Word',
  className = 'h-12 w-auto sm:h-14',
  link = true,
  priority = false,
}: {
  on?: 'light' | 'dark';
  src?: string | null;
  name?: string;
  className?: string;
  link?: boolean;
  priority?: boolean;
}) {
  const img = (
    <Image src={src || DEFAULT_LOGO[on]} alt={link ? '' : name} width={458} height={480} priority={priority} className={`${className} object-contain`} />
  );
  return link ? (
    <Link href="/" aria-label={`${name} home`} className="inline-flex items-center">
      {img}
    </Link>
  ) : img;
}
