import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Size Guide' };

export default function Page() {
  return <ComingSoon title="Size Guide" phase={2} />;
}
