import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Returns and Exchanges' };

export default function Page() {
  return <ComingSoon title="Returns and Exchanges" phase={2} />;
}
