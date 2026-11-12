import Image from 'next/image';
import Link from 'next/link';

/** Uses the logo uploaded in admin when present; otherwise a typographic wordmark. */
export function Logo({ logoUrl }: { logoUrl: string | null }) {
  return (
    <Link href="/" aria-label="Wear The Word home" className="inline-flex items-center">
      {logoUrl ? (
        <Image src={logoUrl} alt="Wear The Word" width={160} height={64} className="h-12 w-auto max-w-40 object-contain" priority />
      ) : (
        <span className="flex flex-col"><span className="display text-xl leading-none tracking-tight sm:text-2xl">WEAR THE WORD</span><span className="mt-1 text-[9px] font-semibold tracking-[.22em]">BY PEMART GLOBAL</span></span>
      )}
    </Link>
  );
}
