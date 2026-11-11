import { Section, Text } from '@react-email/components';
import { formatNaira } from '@/lib/money';
import { C, EmailLayout, h1, p } from './layout';

export default function GiftCardEmail({ code, amountKobo, message, from, siteUrl, whatsappUrl }: { code: string; amountKobo: number; message?: string | null; from?: string | null; siteUrl: string; whatsappUrl?: string }) {
  return (
    <EmailLayout preview={`You have a ${formatNaira(amountKobo)} Pemart gift card`} siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>You have a gift card</Text>
      <Text style={p}>{from ? `${from} sent you` : 'Someone sent you'} a Pemart gift card worth <strong>{formatNaira(amountKobo)}</strong>.</Text>
      {message && <Text style={{ ...p, fontStyle: 'italic' }}>“{message}”</Text>}
      <Section style={{ backgroundColor: C.ink, borderRadius: 8, padding: '20px', textAlign: 'center', margin: '16px 0' }}>
        <Text style={{ color: C.sand, fontSize: 12, letterSpacing: 3, margin: 0 }}>YOUR CODE</Text>
        <Text style={{ color: C.paper, fontSize: 26, fontWeight: 800, letterSpacing: 3, margin: '6px 0 0', fontFamily: 'Courier New, monospace' }}>{code}</Text>
      </Section>
      <Text style={p}>Enter this code at checkout on <a href={siteUrl} style={{ color: C.mocha }}>{siteUrl.replace(/^https?:\/\//, '')}</a>. It is valid for 12 months and can be used across several orders until the balance runs out.</Text>
    </EmailLayout>
  );
}
