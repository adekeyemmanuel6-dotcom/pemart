import { Button, Section, Text } from '@react-email/components';
import { EmailLayout, button, h1, p } from './layout';

const COPY: Record<string, { subject: string; heading: string; body: string }> = {
  in_production: { subject: 'is in production', heading: "We're making it", body: 'Your order is now in production. We will let you know as soon as it is on its way.' },
  out_for_delivery: { subject: 'is out for delivery', heading: 'On its way to you', body: 'Your order is out for delivery. Please keep your phone close: the rider may call.' },
  delivered: { subject: 'has been delivered', heading: 'Delivered. Enjoy.', body: 'Your order has been delivered. We hope you love it. If anything is not right, message us and we will fix it.' },
};
export const statusCopy = (s: string) => COPY[s];

export default function OrderStatus({ number, status, promisedBy, link, siteUrl, whatsappUrl }: { number: string; status: string; promisedBy?: string | null; link: string; siteUrl: string; whatsappUrl?: string }) {
  const c = COPY[status] ?? { subject: 'was updated', heading: 'Order update', body: 'There is an update on your order.' };
  const date = promisedBy && status !== 'delivered' ? new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date(promisedBy)) : null;
  return (
    <EmailLayout preview={`Order ${number} ${c.subject}`} siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>{c.heading}</Text>
      <Text style={p}>Order <strong>{number}</strong>. {c.body}</Text>
      {date && <Text style={p}><strong>Expected by {date}.</strong></Text>}
      <Section style={{ margin: '20px 0 0' }}><Button href={link} style={button}>View your order</Button></Section>
    </EmailLayout>
  );
}
