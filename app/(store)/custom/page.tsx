import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Design Your Own' };

export default function Page() {
  return <ComingSoon title="Design Your Own" phase={3} />;
}
