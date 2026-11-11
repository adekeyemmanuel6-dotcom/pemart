'use client';
import { useBag } from '@/lib/cart-store';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { BagContents } from './bag-contents';

/** The slide-out bag. Opens when something is added, or from the header bag button. */
export function BagDrawer() {
  const open = useBag((s) => s.isOpen), setOpen = useBag((s) => s.setOpen);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent title="Your bag" side="right" className="max-w-lg">
        {open && <BagContents variant="drawer" onNavigate={() => setOpen(false)} />}
      </SheetContent>
    </Sheet>
  );
}
