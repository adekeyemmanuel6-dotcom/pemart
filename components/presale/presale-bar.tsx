'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { PresaleForm, type FormGarment } from './presale-form';

export const OPEN_PRESALE_EVENT = 'presale:open';

/**
 * The slim "Pre-order now" strip across the store, and the full-screen overlay it opens. The overlay holds the same
 * poster and form as the /presale page (the poster arrives as server-rendered children). Anything can open it by
 * dispatching `presale:open`, or by visiting any page with ?presale=1.
 */
export function PresaleBar({ text, garments, states, notesHelp, notice, title, children }: {
  text: string; garments: FormGarment[]; states: string[]; notesHelp: string; notice: string; title: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_PRESALE_EVENT, show);
    if (new URLSearchParams(window.location.search).get('presale') === '1') show();
    return () => window.removeEventListener(OPEN_PRESALE_EVENT, show);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="bg-gold px-4 py-2 text-center text-sm font-semibold text-[#111111]" role="region" aria-label="Pre-sale">
        {text}{' '}
        <Dialog.Trigger className="ml-1 inline-flex min-h-11 items-center rounded-btn bg-ink px-4 text-sm font-bold text-paper hover:bg-ink/85">Pre-Order Now</Dialog.Trigger>
      </div>
      <Dialog.Portal>
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[80] overflow-y-auto bg-[#1b1c1f]">
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Close className="fixed right-3 top-3 z-[90] grid size-12 place-items-center rounded-full bg-white text-ink shadow-lg hover:bg-sand" aria-label="Close pre-sale">
            <X className="size-6" aria-hidden />
          </Dialog.Close>
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div>{children}</div>
            <div className="bg-paper px-5 py-10 text-ink sm:px-10 lg:min-h-screen">
              <PresaleForm garments={garments} states={states} notesHelp={notesHelp} notice={notice} onDone={() => setOpen(false)} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
