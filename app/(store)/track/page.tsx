import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Track Your Order' };

export default function Page() {
  return <ComingSoon title="Track Your Order" phase={5} />;
}
