import { CookieSettingsLink } from '@/components/consent/cookie-settings-link';
import Link from 'next/link';
import { Camera, MessageCircle } from 'lucide-react';
import type { StoreSettings } from '@/lib/settings';
import { whatsappLink } from '@/lib/site';
import { resolveWebsite } from '@/lib/website/schema';
import { NewsletterForm } from './newsletter-form';

const heading = 'mb-3 text-xs font-semibold uppercase tracking-widest text-paper/60';
const link = 'flex min-h-11 items-center text-paper/90 hover:text-white hover:underline underline-offset-4';

export function SiteFooter({ settings }: { settings: StoreSettings }) {
  const content = resolveWebsite(settings);
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <p className="display text-4xl">{content.brand.name}</p>
          <p className="mt-2 text-xs tracking-[.2em]">{content.brand.byline}</p>
          <p className="mt-2 mb-6 max-w-xs text-paper/80">{content.brand.footer}</p>
          <NewsletterForm />
        </div>
        <nav aria-label="Collections">
          <p className={heading}>Collections</p>
          <ul>
            {content.navigation.shop.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className={link}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Help">
          <p className={heading}>Help</p>
          <ul>
            {content.navigation.help.map((h) => (
              <li key={h.href}>
                <Link href={h.href} className={link}>
                  {h.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className={heading}>Say hello</p>
          <ul>
            {settings.whatsapp_number && (
              <li>
                <a
                  className={link}
                  href={whatsappLink(settings.whatsapp_number, 'Hi Wear The Word, I have a question.')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 size-5" aria-hidden />
                  WhatsApp
                </a>
              </li>
            )}
            {settings.instagram_url && (
              <li>
                <a className={link} href={settings.instagram_url} target="_blank" rel="noopener noreferrer">
                  <Camera className="mr-2 size-5" aria-hidden />
                  Instagram
                </a>
              </li>
            )}
            {settings.tiktok_url && (
              <li>
                <a className={link} href={settings.tiktok_url} target="_blank" rel="noopener noreferrer">
                  <span className="mr-2 grid size-5 place-items-center text-sm font-bold" aria-hidden>
                    ♪
                  </span>
                  TikTok
                </a>
              </li>
            )}
          </ul>
          <p className={`${heading} mt-6`}>We accept</p>
          <ul className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Payment methods">
            {['Paystack', 'Card', 'Bank transfer', 'USSD'].map((m) => (
              <li key={m} className="rounded border border-paper/30 px-2.5 py-1">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-paper/70 sm:flex-row sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {content.brand.copyright}
          </p>
          <p className="flex gap-4">
            {content.navigation.legal.map((n) => (
              <Link key={n.href} href={n.href} className="hover:underline">
                {n.name}
              </Link>
            ))}
            <CookieSettingsLink />
          </p>
        </div>
      </div>
    </footer>
  );
}
