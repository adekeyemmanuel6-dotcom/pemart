import { Button, Section, Text } from '@react-email/components';
import { formatNaira } from '@/lib/money';
import { EmailLayout, button, h1, p } from './layout';

export default function ReviewRequest({ number, creditKobo, link, siteUrl, whatsappUrl }: { number: string; creditKobo: number; link: string; siteUrl: string; whatsappUrl?: string }) {
  return (
    <EmailLayout preview={`How is it? Earn ${formatNaira(creditKobo)} credit for a photo review`} siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>How&apos;s it wearing?</Text>
      <Text style={p}>Your order <strong>{number}</strong> arrived a few days ago. We would love to hear what you think.</Text>
      <Text style={p}>Add a photo to your review and, once we approve it, we&apos;ll credit <strong>{formatNaira(creditKobo)}</strong> to your Wear The Word store credit.</Text>
      <Section style={{ margin: '20px 0 0' }}><Button href={link} style={button}>Leave a review</Button></Section>
    </EmailLayout>
  );
}
