import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
export function CollectionEditorial({
  collection: c,
  index,
  image,
}: {
  collection: { slug: string; name: string; blurb: string };
  index: number;
  image: string | null;
}) {
  return (
    <Link
      href={c.slug === 'word-gifts' ? '/gift-boxes' : `/collections/${c.slug}`}
      className={`wtw-collection wtw-collection-${index}`}
    >
      <div className="wtw-collection-art">
        {image ? (
          <Image src={image} alt={c.name} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" />
        ) : (
          <>
            <span className="wtw-eyebrow">0{index + 1} / Wear The Word</span>
            <span className="display wtw-collection-word">
              {c.slug === 'word-gifts' ? 'GIVE\nTHE WORD.' : c.slug.toUpperCase()}
            </span>
            <span className="wtw-placeholder-note">Collection imagery to be supplied</span>
          </>
        )}
      </div>
      <div className="flex justify-between gap-3 pt-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide">{c.name}</h3>
          <p className="mt-1 text-sm text-muted">{c.blurb}</p>
          <span className="mt-3 block text-xs font-semibold uppercase tracking-widest">Shop collection</span>
        </div>
        <ArrowUpRight size={20} aria-hidden className="shrink-0" />
      </div>
    </Link>
  );
}
