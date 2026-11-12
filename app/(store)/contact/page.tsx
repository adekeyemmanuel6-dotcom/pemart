import { getWebsitePage, websitePageMetadata } from '@/lib/website/server';
import { WebsitePageView } from '@/components/website-page';
import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { ContentPage } from '@/components/content-page';
import { Button } from '@/components/ui/button';
import { getSettings } from '@/lib/settings';
import { whatsappLink } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  return websitePageMetadata('contact', {
    title: 'Contact',
    description: 'Talk to Pemart on WhatsApp for questions about orders, sizes, custom designs and gifts.',
    alternates: { canonical: '/contact' },
  });
}
export const revalidate = 300;

export default async function ContactPage() {
  const websitePage = await getWebsitePage('contact');
  const s = await getSettings();
  if (websitePage)
    return (
      <WebsitePageView page={websitePage}>
        <div className="mt-8 flex flex-wrap gap-4">
          {s.whatsapp_number && (
            <Button asChild>
              <a
                href={whatsappLink(s.whatsapp_number, 'Hi, I have a question.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat on WhatsApp
              </a>
            </Button>
          )}
          {s.instagram_url && (
            <a className="underline" href={s.instagram_url} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
          {s.tiktok_url && (
            <a className="underline" href={s.tiktok_url} target="_blank" rel="noopener noreferrer">
              TikTok
            </a>
          )}
        </div>
      </WebsitePageView>
    );
  return (
    <ContentPage
      title="Contact"
      kicker="say hello"
      intro="WhatsApp is the fastest way to reach us. Ask about sizes, custom designs, bulk orders or an order in progress."
    >
      <Button asChild className="not-prose mt-2 bg-[#1f6f3f] hover:bg-[#1a5e35]">
        <a
          href={whatsappLink(s.whatsapp_number, 'Hi Wear The Word, I have a question.')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-5" aria-hidden />
          Chat on WhatsApp
        </a>
      </Button>
      <h2>Have your order number ready</h2>
      <p>
        If you are asking about an order, include your order number (it looks like PM-10001). It helps us find it
        straight away.
      </p>
      {(s.instagram_url || s.tiktok_url) && (
        <>
          <h2>Follow along</h2>
          <ul>
            {s.instagram_url && (
              <li>
                <a href={s.instagram_url} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              </li>
            )}
            {s.tiktok_url && (
              <li>
                <a href={s.tiktok_url} target="_blank" rel="noopener noreferrer">
                  TikTok
                </a>
              </li>
            )}
          </ul>
        </>
      )}
    </ContentPage>
  );
}
