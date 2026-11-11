'use client';
import { Ruler } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import type { SizeGuideType } from '@/lib/size-guide';
import { SizeGuideTable } from './size-guide-table';

export function SizeGuideDrawer({ type }: { type: SizeGuideType }) {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline underline-offset-4 hover:text-denim"><Ruler className="size-4" aria-hidden />Size guide</SheetTrigger>
      <SheetContent title="Size guide"><div className="p-5"><SizeGuideTable type={type} showHow /></div></SheetContent>
    </Sheet>
  );
}
