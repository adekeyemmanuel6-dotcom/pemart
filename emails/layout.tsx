import { Body, Container, Head, Html, Preview, Section, Text, Link, Hr } from '@react-email/components';
import type { ReactNode } from 'react';

export const C = { ink: '#111111', paper: '#F4F0E8', sand: '#E4D8C4', mocha: '#715728', muted: '#6B6560', line: '#D8CFC2', ember: '#D9572B' };

/** Wear The Word email chrome: cream page, dark wordmark, mobile-friendly single column. */
export function EmailLayout({ preview, children, siteUrl, whatsappUrl }: { preview: string; children: ReactNode; siteUrl: string; whatsappUrl?: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: C.paper, margin: 0, padding: '24px 12px', fontFamily: 'Helvetica, Arial, sans-serif', color: C.ink }}>
        <Container style={{ maxWidth: 560, margin: '0 auto' }}>
          <Section style={{ backgroundColor: C.ink, padding: '18px 24px', borderRadius: '8px 8px 0 0' }}>
            <Text style={{ margin: 0, color: C.paper, fontSize: 28, letterSpacing: 4, fontWeight: 800 }}>WEAR THE WORD</Text>
            <Text style={{ margin: "6px 0 0", color: C.paper, fontSize: 11, letterSpacing: 2 }}>BY PEMART GLOBAL</Text>
          </Section>
          <Section style={{ backgroundColor: '#ffffff', padding: '28px 24px', border: `1px solid ${C.line}`, borderTop: 0 }}>{children}</Section>
          <Section style={{ padding: '16px 8px' }}>
            <Text style={{ fontSize: 13, color: C.muted, margin: 0 }}>Wear what you stand on.</Text>
            {whatsappUrl && <Text style={{ fontSize: 13, margin: '6px 0 0' }}>Questions? <Link href={whatsappUrl} style={{ color: C.mocha }}>Message us on WhatsApp</Link></Text>}
            <Hr style={{ borderColor: C.line, margin: '12px 0' }} />
            <Text style={{ fontSize: 12, color: C.muted, margin: 0 }}><Link href={siteUrl} style={{ color: C.muted }}>{siteUrl.replace(/^https?:\/\//, '')}</Link></Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const h1 = { fontSize: 26, lineHeight: '30px', margin: '0 0 12px', fontWeight: 800 } as const;
export const p = { fontSize: 16, lineHeight: '24px', margin: '0 0 12px' } as const;
export const button = { backgroundColor: C.ink, color: C.paper, padding: '14px 22px', borderRadius: 8, fontWeight: 700, fontSize: 16, textDecoration: 'none', display: 'inline-block' } as const;
