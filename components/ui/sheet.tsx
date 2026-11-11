'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

/** Slide-in panel used for the mobile menu, bag drawer and size guide. Focus-trapped and Esc-closable. */
export function SheetContent({
  side = 'right',
  title,
  className,
  children,
}: {
  side?: 'left' | 'right';
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="overlay-fade fixed inset-0 z-50 bg-ink/50" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          'fixed inset-y-0 z-50 flex w-[88vw] max-w-md flex-col bg-paper shadow-xl',
          side === 'right' ? 'sheet-right right-0' : 'sheet-left left-0',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <Dialog.Title className="display text-2xl">{title}</Dialog.Title>
          <Dialog.Close className="grid size-12 place-items-center rounded-btn hover:bg-sand" aria-label="Close">
            <X className="size-6" aria-hidden />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
