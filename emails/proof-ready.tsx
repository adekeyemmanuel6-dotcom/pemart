import { Button, Section, Text } from '@react-email/components';
import { C, EmailLayout, button, h1, p } from './layout';

export default function ProofReady({ number, version, message, link, siteUrl, whatsappUrl }: { number: string; version: number; message?: string | null; link: string; siteUrl: string; whatsappUrl?: string }) {
  return (
    <EmailLayout preview="Your design proof is ready" siteUrl={siteUrl} whatsappUrl={whatsappUrl}>
      <Text style={h1}>Your design proof is ready</Text>
      <Text style={p}>Order <strong>{number}</strong> · proof {version > 1 ? `version ${version}` : 'version 1'}.</Text>
      {message && <Section style={{ backgroundColor: C.sand, padding: '12px 16px', borderRadius: 8, margin: '0 0 16px' }}><Text style={{ ...p, margin: 0, fontStyle: 'italic' }}>“{message}”</Text></Section>}
      <Text style={p}>Take a look and either <strong>approve it</strong> or <strong>ask for changes</strong>. One revision is free.</Text>
      <Section style={{ margin: '20px 0 8px' }}><Button href={link} style={button}>View and approve your proof</Button></Section>
      <Text style={{ fontSize: 14, color: C.muted }}>Your 5-day delivery clock starts the moment you approve. Nothing is printed until you do.</Text>
    </EmailLayout>
  );
}
