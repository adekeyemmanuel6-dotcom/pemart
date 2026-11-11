import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Delivery' };

export default function Page() {
  return <ComingSoon title="Delivery" phase={2} />;
}
