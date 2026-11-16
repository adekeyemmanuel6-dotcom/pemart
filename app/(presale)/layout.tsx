import { StoreShell } from '@/components/layout/store-shell';

/** Pre-sale gets the store's colours and WhatsApp button, but no header, footer or links into the store. */
export default function PresaleLayout({ children }: { children: React.ReactNode }) {
  return <StoreShell minimal>{children}</StoreShell>;
}
