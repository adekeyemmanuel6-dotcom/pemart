import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { formatNaira } from '@/lib/money';

export const metadata = { title: 'Style guide', robots: { index: false } };

const tokens = [
  ['ink', '#141414', 'Primary text, dark sections'], ['paper', '#F6F1E8', 'Page background'], ['sand', '#E4D8C4', 'Cards, surfaces'],
  ['denim', '#5B7FA6', 'Accent, focus rings'], ['mocha', '#7A5A45', 'Secondary accent'], ['ember', '#D9572B', 'Sale, urgency'],
  ['muted', '#6B6560', 'Secondary text'], ['line', '#D8CFC2', 'Borders'],
];

/** Developer-only reference for the design tokens. Hidden in production. */
export default function StyleGuide() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-14 px-4 py-12 sm:px-6">
      <header><h1 className="display text-6xl">Style guide</h1><p className="text-muted">Tokens, type and components. Developer page, hidden in production.</p></header>
      <section>
        <h2 className="display mb-4 text-3xl">Colour</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tokens.map(([n, hex, use]) => (
            <li key={n} className="overflow-hidden rounded-lg border border-line">
              <div className="h-20" style={{ background: hex }} />
              <div className="p-3 text-sm"><p className="font-semibold">--{n}</p><p className="text-muted">{hex}</p><p className="text-muted">{use}</p></div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="display mb-4 text-3xl">Type</h2>
        <p className="display text-7xl">Wear what you believe</p>
        <p className="mt-3 text-lg">Body in Inter, 16px minimum. <span className="font-script text-3xl text-mocha">for you</span></p>
        <p className="mt-2 text-muted">Prices: {formatNaira(2200000)}, {formatNaira(3750000)}, {formatNaira(10500000)}</p>
      </section>
      <section>
        <h2 className="display mb-4 text-3xl">Buttons and fields</h2>
        <div className="flex flex-wrap gap-3"><Button>Add to bag</Button><Button variant="secondary">Make it yours</Button><Button variant="ember">Order by 17 Dec</Button><Button variant="ghost">Ghost</Button></div>
        <div className="mt-6 max-w-sm"><Label htmlFor="demo">Email</Label><Input id="demo" placeholder="you@email.com" /></div>
        <div className="skeleton mt-6 h-24 max-w-sm" aria-label="Loading skeleton" />
      </section>
    </div>
  );
}
