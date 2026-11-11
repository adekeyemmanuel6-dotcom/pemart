'use client';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/site';

const humanise = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Floating WhatsApp button. The pre-filled message names the page or product the visitor is on. */
export function WhatsAppButton({ number }: { number: string | null }) {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const about =
    parts[0] === 'products' && parts[1] ? `the "${humanise(parts[1])}"`
    : parts[0] === 'bundles' && parts[1] ? `the "${humanise(parts[1])}" bundle`
    : parts.length ? `your ${humanise(parts[parts.length - 1]!)} page` : 'your store';
  const message = `Hi Pemart, I have a question about ${about}.`;
  return (
    <a
      href={whatsappLink(number, message)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#1f8f4e] text-white shadow-lg transition-transform duration-150 hover:scale-105 md:bottom-6"
      aria-label="Chat with Pemart on WhatsApp"
    >
      <MessageCircle className="size-7" aria-hidden />
    </a>
  );
}
