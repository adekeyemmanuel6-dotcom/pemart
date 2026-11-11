import type { Metadata } from 'next';
import { ContentPage } from '@/components/content-page';

export const metadata: Metadata = { title: 'Privacy', description: 'What Pemart collects, why, who we share it with, and your choices.', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy" kicker="your data" intro="We collect only what we need to make, deliver and support your order. This page explains what that is.">
      <h2>What we collect</h2>
      <ul>
        <li><strong>Contact details:</strong> name, email and phone (used for order updates, including on WhatsApp).</li>
        <li><strong>Delivery details:</strong> your address and delivery area.</li>
        <li><strong>Orders:</strong> what you bought, the options you chose, gift messages and payment status.</li>
        <li><strong>Custom design files:</strong> text, images, PDFs or sketches you upload, and the proofs we send back.</li>
        <li><strong>Account:</strong> if you sign in, your email or Google account name and email, saved addresses, wishlist and store credit.</li>
        <li><strong>Reviews:</strong> ratings, comments and photos you choose to submit.</li>
        <li><strong>Newsletter and offers:</strong> your email or phone and the date and time you opted in.</li>
      </ul>
      <p>We never see or store your card details. Payments are handled by Paystack.</p>
      <h2>How we use it</h2>
      <p>To process and deliver orders, send proofs and updates, give support, prevent fraud, and, only if you opted in, send offers. You can opt out of marketing at any time.</p>
      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Paystack</strong> to take payments.</li>
        <li><strong>Supabase</strong> for our database, sign-in and file storage.</li>
        <li><strong>Resend</strong> to send emails.</li>
        <li><strong>Vercel</strong> to host this website.</li>
        <li>Delivery partners, who receive your name, phone and address to deliver your parcel.</li>
      </ul>
      <p>We do not sell your personal data.</p>
      <h2>Cookies and analytics</h2>
      <p>Essential storage keeps your bag and your sign-in working. We only load analytics and marketing tools (such as Google Analytics and Meta Pixel) after you accept them in the cookie banner, and you can change your choice at any time.</p>
      <h2>Your uploads</h2>
      <p>Design files you upload are stored privately and used only to produce your order. Please only upload images you have the right to use.</p>
      <h2>Keeping and deleting data</h2>
      <p>We keep order records for as long as needed for accounting and support. You can ask us to access, correct or delete your personal data, subject to records we must keep by law, by messaging us on WhatsApp. We handle personal data in line with the Nigeria Data Protection Act.</p>
      <h2>Changes</h2>
      <p>If this policy changes in a meaningful way, we will update this page.</p>
    </ContentPage>
  );
}
