import { Button, Column, Hr, Row, Section, Text } from '@react-email/components';
import { formatNaira } from '@/lib/money';
import { C, EmailLayout, button, h1, p } from './layout';

export type EmailOrder = {
  number: string; token: string; hasCustom: boolean; proofHours: number | null; promisedBy: string | null;
  items: { name: string; quantity: number; unitKobo: number; contents: string[]; giftMessage?: string | null }[];
  subtotalKobo: number; discountKobo: number; deliveryFeeKobo: number; extrasKobo: number; creditKobo: number; giftCardKobo: number; totalKobo: number;
  address: { recipient: string; line1: string; area?: string; city: string; state: string };
  giftMessage?: string | null;
};

const fmtDate = (iso: string) => new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date(iso));

export default function OrderConfirmation({ o, siteUrl, whatsappUrl }: { o: EmailOrder; siteUrl: string; whatsappUrl?: string }) {
  const link = `${siteUrl}/order/${o.number}?t=${o.token}`;
  return (
    <EmailLayout preview={`Thanks! Order ${o.number} is confirmed.`} siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>Thank you. Your order is in.</Text>
      <Text style={p}>Order <strong>{o.number}</strong> is paid and confirmed.</Text>

      {o.hasCustom ? (
        <Section style={{ backgroundColor: C.sand, padding: '14px 16px', borderRadius: 8, margin: '0 0 16px' }}>
          <Text style={{ ...p, margin: 0 }}><strong>Next: your design proof.</strong> We will email you a proof within {o.proofHours ?? 24} hours. Approve it (or ask for one free revision) and <strong>your 5-day delivery clock starts the day you approve</strong>.</Text>
        </Section>
      ) : o.promisedBy ? (
        <Section style={{ backgroundColor: C.sand, padding: '14px 16px', borderRadius: 8, margin: '0 0 16px' }}>
          <Text style={{ ...p, margin: 0 }}><strong>Arriving by {fmtDate(o.promisedBy)}.</strong> We start making it today.</Text>
        </Section>
      ) : null}

      <Text style={{ ...p, fontWeight: 700, margin: '8px 0 4px' }}>What you ordered</Text>
      {o.items.map((i, idx) => (
        <Section key={idx} style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 0' }}>
          <Row>
            <Column><Text style={{ ...p, margin: 0 }}>{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.name}</Text>
              {i.contents.map((c) => (<Text key={c} style={{ fontSize: 13, color: C.muted, margin: '2px 0 0' }}>{c}</Text>))}
              {i.giftMessage && <Text style={{ fontSize: 13, fontStyle: 'italic', margin: '4px 0 0' }}>Gift message: “{i.giftMessage}”</Text>}</Column>
            <Column align="right" style={{ width: 110, verticalAlign: 'top' }}><Text style={{ ...p, margin: 0 }}>{formatNaira(i.unitKobo * i.quantity)}</Text></Column>
          </Row>
        </Section>
      ))}

      <Section style={{ padding: '12px 0 0' }}>
        {[
          ['Subtotal', o.subtotalKobo], ['Discount', -o.discountKobo], ['Delivery', o.deliveryFeeKobo], ['Extras', o.extrasKobo], ['Gift card', -o.giftCardKobo], ['Store credit', -o.creditKobo],
        ].filter(([, v]) => v !== 0).map(([l, v]) => (
          <Row key={String(l)}><Column><Text style={{ fontSize: 14, margin: '2px 0', color: C.muted }}>{l}</Text></Column><Column align="right"><Text style={{ fontSize: 14, margin: '2px 0' }}>{formatNaira(v as number)}</Text></Column></Row>
        ))}
        <Hr style={{ borderColor: C.line }} />
        <Row><Column><Text style={{ ...p, fontWeight: 800, margin: 0 }}>Total paid</Text></Column><Column align="right"><Text style={{ ...p, fontWeight: 800, margin: 0 }}>{formatNaira(o.totalKobo)}</Text></Column></Row>
      </Section>

      <Text style={{ ...p, fontWeight: 700, margin: '20px 0 4px' }}>Delivering to</Text>
      <Text style={{ ...p, margin: 0 }}>{o.address.recipient}<br />{o.address.line1}{o.address.area ? `, ${o.address.area}` : ''}<br />{o.address.city}, {o.address.state}</Text>
      {o.giftMessage && <Text style={{ ...p, fontStyle: 'italic', margin: '12px 0 0' }}>Gift message: “{o.giftMessage}”</Text>}

      <Section style={{ margin: '24px 0 4px' }}><Button href={link} style={button}>View your order</Button></Section>
      <Text style={{ fontSize: 13, color: C.muted }}>Custom and personalised items are final sale, except for print defects, which we replace free.</Text>
    </EmailLayout>
  );
}
