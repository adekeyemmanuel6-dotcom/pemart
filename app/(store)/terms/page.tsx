import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Terms' };

export default function Page() {
  return <ComingSoon title="Terms" phase={2} />;
}
