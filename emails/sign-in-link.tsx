import { Button, Section, Text } from '@react-email/components';
import { C, EmailLayout, button, h1, p } from './layout';

/**
 * The password-free sign-in email. Supabase Auth sends this one: paste the rendered HTML (with {{ .ConfirmationURL }}
 * in place of `link`) into Supabase > Authentication > Email Templates > Magic Link. See README.
 */
export default function SignInLink({ link, siteUrl }: { link: string; siteUrl: string }) {
  return (
    <EmailLayout preview="Your Pemart sign-in link" siteUrl={siteUrl}>
      <Text style={h1}>Sign in to Pemart</Text>
      <Text style={p}>Tap the button to sign in. No password needed. The link works once and expires soon.</Text>
      <Section style={{ margin: '20px 0 8px' }}><Button href={link} style={button}>Sign in</Button></Section>
      <Text style={{ fontSize: 13, color: C.muted }}>If you did not ask for this, you can ignore this email.</Text>
    </EmailLayout>
  );
}
