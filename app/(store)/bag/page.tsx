import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplyCodeFromUrl } from '@/components/bag/apply-code-from-url';
import { BagContents } from '@/components/bag/bag-contents';

export const metadata: Metadata = { title: 'Your Bag', robots: { index: false } };

export default function BagPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="display mb-6 text-5xl sm:text-6xl">Your bag</h1>
      <Suspense><ApplyCodeFromUrl /></Suspense>
      <BagContents variant="page" />
    </section>
  );
}
