import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Privacy' };

export default function Page() {
  return <ComingSoon title="Privacy" phase={2} />;
}
