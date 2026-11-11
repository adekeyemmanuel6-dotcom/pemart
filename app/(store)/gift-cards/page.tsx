import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Gift Cards' };

export default function Page() {
  return <ComingSoon title="Gift Cards" phase={3} />;
}
