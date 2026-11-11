import { Button, Section, Text } from '@react-email/components';
import { EmailLayout, button, h1, p } from './layout';

export default function ProofApproved({ number, promisedBy, link, siteUrl, whatsappUrl }: { number: string; promisedBy: string | null; link: string; siteUrl: string; whatsappUrl?: string }) {
  const date = promisedBy ? new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date(promisedBy)) : null;
  return (
    <EmailLayout preview="Design approved. We are on it." siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>Approved. We&apos;re on it.</Text>
      <Text style={p}>Thanks for approving your design for order <strong>{number}</strong>. Your 5-day delivery clock has started.</Text>
      {date && <Text style={p}><strong>Arriving by {date}.</strong></Text>}
      <Section style={{ margin: '20px 0 0' }}><Button href={link} style={button}>Follow your order</Button></Section>
    </EmailLayout>
  );
}
