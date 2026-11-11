import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Bulk Orders' };

export default function Page() {
  return <ComingSoon title="Bulk Orders" phase={3} />;
}
