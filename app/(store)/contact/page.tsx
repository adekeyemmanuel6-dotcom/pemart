import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return <ComingSoon title="Contact" phase={2} />;
}
