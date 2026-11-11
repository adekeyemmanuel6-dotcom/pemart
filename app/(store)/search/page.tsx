import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchBox } from '@/components/search/search-box';

export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default function SearchPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display mb-6 text-5xl">Search</h1>
      <Suspense fallback={<div className="skeleton h-14" />}><SearchBox /></Suspense>
    </section>
  );
}
