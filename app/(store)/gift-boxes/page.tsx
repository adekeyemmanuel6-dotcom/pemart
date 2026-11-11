import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Gift Boxes' };

export default function Page() {
  return <ComingSoon title="Gift Boxes" phase={3} />;
}
