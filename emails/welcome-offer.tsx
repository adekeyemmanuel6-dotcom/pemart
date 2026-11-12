import { Text } from '@react-email/components';
import { EmailLayout, h1, p } from './layout';

export default function WelcomeOffer({ code, expires, siteUrl, whatsappUrl }: { code: string; expires?: string; siteUrl: string; whatsappUrl?: string }) {
  return (
    <EmailLayout preview="Your 10% off first order code" siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>Welcome to Wear The Word.</Text>
      <Text style={p}>Here is your code for <strong>10% off your first order</strong>:</Text>
      <Text style={{ ...p, fontSize: '28px', fontWeight: 700, letterSpacing: '2px', margin: '8px 0 16px' }}>{code}</Text>
      <Text style={p}>It works once, on one order{expires ? `, and is valid until ${expires}` : ''}. Enter it in your bag, or open <a href={`${siteUrl}/bag?code=${encodeURIComponent(code)}`}>this link</a> and we will apply it for you.</Text>
    </EmailLayout>
  );
}
