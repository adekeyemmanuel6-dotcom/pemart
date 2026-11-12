import { Button, Section, Text } from '@react-email/components';
import { formatNaira } from '@/lib/money';
import { EmailLayout, button, h1, p } from './layout';

export default function BulkQuoteReady({ name, totalKobo, link, siteUrl, whatsappUrl }: { name: string; totalKobo: number; link: string; siteUrl: string; whatsappUrl?: string }) {
  return (
    <EmailLayout preview={`Your Wear The Word bulk quote: ${formatNaira(totalKobo)}`} siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>Your quote is ready, {name.split(' ')[0]}</Text>
      <Text style={p}>Your group price is <strong>{formatNaira(totalKobo)}</strong>. Pay securely with Paystack to confirm your order. We start as soon as payment is confirmed, and this link stays open for 7 days.</Text>
      <Section style={{ margin: '20px 0 8px' }}><Button href={link} style={button}>View quote and pay</Button></Section>
      <Text style={{ fontSize: 14 }}>Questions about sizes or the design? Reply on WhatsApp and we will sort it out.</Text>
    </EmailLayout>
  );
}
