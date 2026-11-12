import Image from 'next/image';
import Link from 'next/link';

/** Uses the logo uploaded in admin when present; otherwise a typographic wordmark. */
export function Logo({
  logoUrl,
  name = 'Wear The Word',
  byline = 'BY PEMART GLOBAL',
}: {
  logoUrl: string | null;
  name?: string;
  byline?: string;
}) {
  return (
    <Link href="/" aria-label={`${name} home`} className="inline-flex items-center">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={160}
          height={64}
          className="h-12 w-auto max-w-40 object-contain"
          priority
        />
      ) : (
        <span className="flex flex-col">
          <span className="display text-xl leading-none tracking-tight sm:text-2xl">{name}</span>
          <span className="mt-1 text-[9px] font-semibold tracking-[.22em]">{byline}</span>
        </span>
      )}
    </Link>
  );
}
