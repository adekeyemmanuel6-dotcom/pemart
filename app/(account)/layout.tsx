import { StoreShell } from '@/components/layout/store-shell';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}
