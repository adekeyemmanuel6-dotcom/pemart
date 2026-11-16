import { Text } from '@react-email/components';
import { EmailLayout, h1, p } from './layout';

export default function PresaleReceived({ name, reference, lines, location, successText, intro, footer, siteUrl, whatsappUrl }: {
  name: string; reference: string; lines: string[]; location: string; successText: string; intro?: string; footer?: string; siteUrl: string; whatsappUrl?: string;
}) {
  return (
    <EmailLayout preview={`Your pre-order request ${reference}`} siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>Thanks, {name.split(' ')[0]}.</Text>
      <Text style={p}>{successText}</Text>
      {intro && <Text style={p}>{intro}</Text>}
      <Text style={p}>Reference: <strong>{reference}</strong></Text>
      {lines.map((l) => (<Text key={l} style={{ ...p, margin: '0 0 4px' }}>{l}</Text>))}
      <Text style={{ ...p, marginTop: 12 }}>Delivery to: {location}</Text>
      <Text style={p}>This is a request, not a payment. We will confirm price, availability and delivery with you before you pay anything.</Text>
      {footer && <Text style={p}>{footer}</Text>}
    </EmailLayout>
  );
}
