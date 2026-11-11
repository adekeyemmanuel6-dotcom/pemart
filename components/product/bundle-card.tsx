import Image from 'next/image';
import Link from 'next/link';
import type { Bundle } from '@/lib/catalogue/types';
import { formatNaira } from '@/lib/money';

export function BundleCard({ bundle, separateKobo, contents }: { bundle: Bundle; separateKobo: number; contents: string }) {
  const saving = separateKobo - bundle.price_kobo;
  const until = bundle.available_until ? new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date(bundle.available_until)) : null;
  return (
    <Link href={`/bundles/${bundle.slug}`} className="group block h-full rounded-lg border border-line bg-white p-3 transition-shadow duration-150 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-sand">
        <Image src={bundle.image ?? '/placeholders/gift-box.svg'} alt="" fill sizes="(min-width:1024px) 25vw, 80vw" className="object-cover" />
        {bundle.badge && <span className="absolute left-2 top-2 rounded bg-ink px-2 py-1 text-xs font-bold uppercase tracking-wide text-paper">{bundle.badge}</span>}
      </div>
      <h3 className="display mt-3 text-2xl">{bundle.name}</h3>
      <p className="mt-1 text-sm text-muted">{contents}</p>
      <p className="mt-2"><span className="text-lg font-semibold">{formatNaira(bundle.price_kobo)}</span>{saving > 0 && <> <span className="text-muted line-through">{formatNaira(separateKobo)}</span> <span className="text-sm font-semibold text-mocha">Save {formatNaira(saving)}</span></>}</p>
      {until && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Order by {until}</p>}
    </Link>
  );
}
