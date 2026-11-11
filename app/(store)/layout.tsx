import { StoreShell } from '@/components/layout/store-shell';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}
