import { Button, Section, Text } from '@react-email/components';
import { formatNaira } from '@/lib/money';
import { EmailLayout, button, h1, p } from './layout';

export default function AbandonedCheckout({ number, totalKobo, link, siteUrl, whatsappUrl }: { number: string; totalKobo: number; link: string; siteUrl: string; whatsappUrl?: string }) {
  return (
    <EmailLayout preview="You left something behind" siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>You left something behind</Text>
      <Text style={p}>Your order <strong>{number}</strong> ({formatNaira(totalKobo)}) is saved and waiting. We are holding your items for 24 hours.</Text>
      <Section style={{ margin: '20px 0 8px' }}><Button href={link} style={button}>Complete your payment</Button></Section>
      <Text style={{ fontSize: 14 }}>Need help or want to change something? Reply on WhatsApp and we will sort it out.</Text>
    </EmailLayout>
  );
}
