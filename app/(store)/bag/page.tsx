import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Your Bag' };

export default function Page() {
  return <ComingSoon title="Your Bag" phase={4} />;
}
