import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/db';

export const metadata: Metadata = { title: 'Owner’s guide' };

export default async function HelpPage() {
  const me = await requireStaff('/admin/help');
  const admin = me.role === 'admin';
  return (
    <div className="prose-pemart mt-6 max-w-3xl pb-10">
      <h1 className="display text-4xl sm:text-5xl">Owner&apos;s guide</h1>
      <p className="mt-2 text-muted">How to run Pemart day to day. {admin ? 'You are an admin: you can see everything.' : 'You are staff: you handle orders, proofs, quotes and reviews.'}</p>

      <Card title="Every morning (10 minutes)" className="mt-6">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open <Link href="/admin">Overview</Link>. Red numbers need you first: <strong>proofs late</strong>, <strong>orders at risk</strong>, <strong>refunds needed</strong>.</li>
          <li>Open <Link href="/admin/proofs">Proofs</Link>. Send every first proof within its promise: Personalise 12 hours, Text design 24 hours, Full custom 48 hours.</li>
          <li>Open <Link href="/admin/production">Production</Link>. Tick the orders you are starting and move them to <em>In production</em>. Anything red is due within 24 hours.</li>
          <li>Check <Link href="/admin/quotes">Bulk quotes</Link> and <Link href="/admin/reviews">Reviews</Link>.</li>
        </ol>
      </Card>

      <h2>Orders</h2>
      <ul>
        <li><strong>Find an order:</strong> Orders &gt; search by number, name, phone or email. Filter by status, zone, custom or promised date.</li>
        <li><strong>Move an order:</strong> open it and use &ldquo;Move this order&rdquo;. Moving to <em>in production</em>, <em>out for delivery</em> or <em>delivered</em> emails the customer automatically.</li>
        <li><strong>WhatsApp:</strong> the green button on an order opens WhatsApp with the order number and status already typed. Tap send.</li>
        <li><strong>Packing slip:</strong> opens a clean printable page (no prices). Print it and put it in the box.</li>
        <li><strong>Refunds:</strong> &ldquo;Record a refund&rdquo; only <em>records</em> it here. You must also send the money back in the Paystack dashboard. Orders flagged &ldquo;Refund needed&rdquo; (paid twice, or paid after the order expired) are shown in red.</li>
        <li><strong>Notes:</strong> internal notes are only visible to staff.</li>
      </ul>

      <h2>Custom design proofs</h2>
      <ol>
        <li>Open the brief (words, style or the customer&apos;s idea and uploads).</li>
        <li>Make the proof, then upload it as a PNG, JPG or PDF and add a short message. <strong>Send proof to customer.</strong></li>
        <li>The customer approves or asks for changes. One revision is free; more cost ₦2,000 and they pay online.</li>
        <li><strong>The 5-day delivery clock starts when the customer approves</strong> (for orders with several designs, when the last one is approved). You do not set dates by hand.</li>
        <li>You cannot start production on a custom order before it is approved.</li>
      </ol>

      <h2>Bulk quotes</h2>
      <p>Move a request to <em>Quoted</em> and type the amount. When the customer agrees, open <em>Turn into an order</em>, add the delivery address, and they get an email with a payment link that stays open for 7 days.</p>

      <h2>Reviews</h2>
      <p>Approve genuine reviews. Approving a review <strong>with a photo</strong> gives the customer ₦2,000 store credit, once. Reject anything inappropriate.</p>

      {admin && (<>
        <h2>Catalogue (admin)</h2>
        <ul>
          <li><strong>New product:</strong> Catalogue &gt; Products &gt; New product. Then add photos (reorder with the arrows, write alt text) and variants. &ldquo;Add colours, sizes or options in bulk&rdquo; makes every combination at once.</li>
          <li><strong>Stock:</strong> only stocked items (bracelets, perfume…) have counts. Adjust on the product page and give a reason: every change is logged. Items made to order never run out.</li>
          <li><strong>Bundles and gift boxes:</strong> Catalogue &gt; Bundles. Each item has rules: which designs are allowed, whether the customer picks a size, colour or option, and matching groups (a couple&apos;s tees must match). Gift boxes hide themselves after their &ldquo;available until&rdquo; time.</li>
          <li><strong>Hide, don&apos;t delete:</strong> untick &ldquo;Visible&rdquo; to take something off the store. Old orders keep their details.</li>
        </ul>
        <h2>Discounts and ambassadors (admin)</h2>
        <ul>
          <li>Create codes with a start and end date, minimum spend and usage limits. Only one code can be used per order.</li>
          <li>An <strong>ambassador</strong> gets a personal code: buyers get 10% off and the ambassador earns 10% of the order subtotal. &ldquo;Mark as paid&rdquo; records that you paid what is owed. Do the transfer yourself.</li>
        </ul>
        <h2>Reports (admin)</h2>
        <p>Pick a date range, see sales by day, best-sellers, bundles, collections, zones and ambassadors. Each table has a CSV download.</p>
        <h2>Settings (admin)</h2>
        <ul>
          <li><strong>Announcement bar</strong>, logo, WhatsApp number and social links.</li>
          <li><strong>Delivery zones:</strong> fees, the free-delivery threshold, delivery days and the Christmas cutoff date for each area.</li>
          <li><strong>Add-on prices</strong> and the bag offer.</li>
          <li><strong>Maintenance mode</strong> shows a &ldquo;back soon&rdquo; page and pauses orders. Turn it off to reopen.</li>
        </ul>
      </>)}

      <h2>Christmas checklist</h2>
      <ol>
        <li>Set the announcement bar to the Lagos cutoff date, and check each zone&apos;s cutoff in Settings.</li>
        <li>Check gift box stock (bracelets, perfume, orb balls) on Overview &gt; Low stock.</li>
        <li>After 24 December the gift boxes hide themselves. Switch the announcement bar off or change it.</li>
      </ol>

      <h2>When something goes wrong</h2>
      <ul>
        <li><strong>A customer says they paid but the order is unpaid:</strong> open Orders, tick <em>Include unpaid</em>, find it. Payments are confirmed by Paystack within seconds. If it is still unpaid after a few minutes, check the Paystack dashboard for the reference shown on the order.</li>
        <li><strong>Wrong size or print defect:</strong> custom items are final sale, except print defects, which we replace free. Move the order to <em>Reprint</em> from <em>Quality check</em> or record the refund.</li>
        <li><strong>Emails not arriving:</strong> check the Resend dashboard and that your domain is verified.</li>
      </ul>
    </div>
  );
}
