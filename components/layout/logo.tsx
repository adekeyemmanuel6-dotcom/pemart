import Image from 'next/image';
import Link from 'next/link';

/** Uses the logo uploaded in admin when present; otherwise a typographic wordmark. */
export function Logo({ logoUrl }: { logoUrl: string | null }) {
  return (
    <Link href="/" aria-label="Pemart home" className="inline-flex items-center">
      {logoUrl ? (
        <Image src={logoUrl} alt="Pemart" width={120} height={36} className="h-9 w-auto" priority />
      ) : (
        <span className="display text-3xl tracking-wide">Pemart</span>
      )}
    </Link>
  );
}
