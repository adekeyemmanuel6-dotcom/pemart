import Image from 'next/image';
import Link from 'next/link';
import { safeHref } from '@/lib/website/schema';
import type { WebsitePage } from '@/lib/website/schema';

function inline(text: string) {
  const pieces: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    pieces.push(text.slice(last, match.index));
    pieces.push(
      safeHref.safeParse(match[2]).success ? (
        <Link key={match.index} href={match[2]!} className="underline">
          {match[1]}
        </Link>
      ) : (
        match[0]
      ),
    );
    last = match.index! + match[0].length;
  }
  pieces.push(text.slice(last));
  return pieces;
}
/** Plain text is escaped by React. No arbitrary HTML or script is accepted. */
export function PageBody({ body }: { body: string }) {
  return (
    <div className="prose-pemart space-y-5">
      {body
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((block, i) =>
          block.startsWith('## ') ? (
            <h2 key={i}>{inline(block.slice(3))}</h2>
          ) : block.startsWith('- ') ? (
            <ul key={i}>
              {block.split('\n').map((line, j) => (
                <li key={j}>{inline(line.replace(/^- /, ''))}</li>
              ))}
            </ul>
          ) : (
            <p key={i} className="whitespace-pre-line">
              {inline(block)}
            </p>
          ),
        )}
    </div>
  );
}
export function WebsitePageView({ page, children }: { page: WebsitePage; children?: React.ReactNode }) {
  return (
    <article className="wtw-section max-w-4xl">
      <p className="wtw-eyebrow">{page.kicker}</p>
      <h1 className="display mt-6 text-5xl sm:text-7xl">{page.title}</h1>
      {page.intro && <p className="my-8 text-lg text-muted whitespace-pre-line">{page.intro}</p>}
      {page.image && (
        <div className="relative my-8 aspect-video">
          <Image
            src={page.image}
            alt={page.alt}
            fill
            sizes="(min-width:1024px) 900px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="mt-8">
        <PageBody body={page.body} />
        {children}
      </div>
    </article>
  );
}
