import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Our Story',
  description:
    'Discover Wear The Word by Pemart Global. Christian lifestyle, apparel and gifting, rooted in Scripture and made for everyday life.',
  alternates: { canonical: '/about' },
};
export default function AboutPage() {
  return (
    <article className="wtw-section">
      <p className="wtw-eyebrow">Wear The Word — Our Story</p>
      <h1 className="display mt-8 max-w-4xl text-6xl sm:text-8xl">The Word was never meant to be kept on a page.</h1>
      <div className="prose-pemart mt-12">
        <p>
          Every season of life comes with its own questions, challenges, battles, decisions and victories. And in every
          season, there is a Word from God to stand on.
        </p>
        <p>
          A Word that gives courage when fear shows up. A Word that reminds us who we are when life tries to define us.
          A Word that gives hope when the future seems uncertain.
        </p>
        <p>
          But we believe God’s Word should be more than something we read, quote or hear on Sundays. It should become
          part of who we are. It should shape how we think, how we live, how we speak and how we show up in the world.
        </p>
        <h2>This is why Wear The Word was born.</h2>
        <p>
          Inspired by{' '}
          <a
            href="https://www.biblegateway.com/passage/?search=Psalm%20138%3A2&amp;version=KJV"
            target="_blank"
            rel="noopener noreferrer"
          >
            Psalm 138:2
          </a>
          , we believe God’s Word deserves to be honoured, remembered, lived and boldly represented.
        </p>
        <p>
          We create clothing and lifestyle pieces that turn timeless biblical truths into meaningful everyday
          expressions. Every design carries a message. Every message has a meaning. Every piece is an opportunity to
          remind someone of what God has said.
        </p>
        <p>Because faith is not just what we say. It is what we believe, how we live and what we stand for.</p>
        <h2>Don’t just read the Word. Don’t just speak the Word. Wear the Word.</h2>
        <p>
          Wear The Word by Pemart Global. Christian lifestyle, apparel &amp; gifting. From Akure, Ondo State, Nigeria.
        </p>
        <Link href="/collections/all">Shop the collection →</Link>
      </div>
    </article>
  );
}
