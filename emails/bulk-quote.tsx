import { Text } from '@react-email/components';
import { EmailLayout, h1, p } from './layout';

export default function BulkQuoteReceived({ name, quantity, ref, siteUrl, whatsappUrl }: { name: string; quantity: number; ref: string; siteUrl: string; whatsappUrl?: string }) {
  return (
    <EmailLayout preview="We got your bulk quote request" siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>Thanks, {name.split(' ')[0]}.</Text>
      <Text style={p}>We have your request for about <strong>{quantity} pieces</strong> (reference <strong>{ref}</strong>). We will send your group price on WhatsApp or by email soon.</Text>
      <Text style={p}>Group pricing: 10% off for 10 to 24 pieces, 15% off for 25 to 99, and custom quotes for 100 or more.</Text>
    </EmailLayout>
  );
}
