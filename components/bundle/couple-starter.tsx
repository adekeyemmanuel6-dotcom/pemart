'use client';
import Link from 'next/link';
import { useState } from 'react';
import { GarmentMockup } from '@/components/product/garment-mockup';
import { Button } from '@/components/ui/button';
import { formatNaira } from '@/lib/money';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
type Pkg = { slug: string; name: string; priceKobo: number; garment: 'tee' | 'hoodie'; blurb: string };

/** Pick a matching design and package, set his and hers sizes, then continue to the full builder, prefilled. */
export function CoupleStarter({ designs, packages }: { designs: { slug: string; name: string }[]; packages: Pkg[] }) {
  const [design, setDesign] = useState(designs[0]!.slug);
  const [pkgSlug, setPkgSlug] = useState(packages[0]!.slug);
  const [his, setHis] = useState('L');
  const [her, setHer] = useState('M');
  const pkg = packages.find((p) => p.slug === pkgSlug)!;
  const chip = (on: boolean) => `min-h-11 min-w-11 rounded-btn border-2 px-3 text-sm font-semibold ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-white hover:border-ink'}`;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3" aria-label="Preview of the matching pair">
        <div><GarmentMockup type={pkg.garment} colour="Black" view="back" designSlug={design} className="rounded-lg" /><p className="mt-2 text-center font-semibold">His · {his}</p></div>
        <div><GarmentMockup type={pkg.garment} colour="Sand" view="back" designSlug={design} className="rounded-lg" /><p className="mt-2 text-center font-semibold">Hers · {her}</p></div>
      </div>
      <div className="space-y-6">
        <fieldset><legend className="mb-2 text-sm font-semibold">Matching design</legend>
          <div className="flex flex-wrap gap-2">{designs.map((d) => (<button key={d.slug} type="button" aria-pressed={design === d.slug} onClick={() => setDesign(d.slug)} className={chip(design === d.slug)}>{d.name}</button>))}</div></fieldset>
        <fieldset><legend className="mb-2 text-sm font-semibold">Package</legend>
          <div className="grid gap-2">{packages.map((p) => (
            <label key={p.slug} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-btn border-2 px-4 py-2 ${pkgSlug === p.slug ? 'border-ink bg-white' : 'border-line'}`}>
              <input type="radio" name="pkg" checked={pkgSlug === p.slug} onChange={() => setPkgSlug(p.slug)} className="size-5 accent-ink" />
              <span className="flex-1"><span className="font-semibold">{p.name}</span><span className="block text-sm text-muted">{p.blurb}</span></span>
              <span className="font-bold">{formatNaira(p.priceKobo)}</span>
            </label>))}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset><legend className="mb-2 text-sm font-semibold">His size</legend><div className="flex flex-wrap gap-2">{SIZES.map((s) => (<button key={s} type="button" aria-pressed={his === s} onClick={() => setHis(s)} className={chip(his === s)}>{s}</button>))}</div></fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">Her size</legend><div className="flex flex-wrap gap-2">{SIZES.map((s) => (<button key={s} type="button" aria-pressed={her === s} onClick={() => setHer(s)} className={chip(her === s)}>{s}</button>))}</div></fieldset>
        </div>
        <Button asChild className="w-full sm:w-auto"><Link href={`/bundles/${pkg.slug}?design=${design}&his=${his}&her=${her}`}>Continue with these choices</Link></Button>
        <p className="text-sm text-muted">You can still change colours, add perfume or frame choices, and write a gift message on the next step.</p>
      </div>
    </div>
  );
}
