import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getCatalogue } from '@/lib/catalogue/load';
import { productBySlug } from '@/lib/catalogue/helpers';
import { formatNaira } from '@/lib/money';

const size = { width: 1200, height: 630 };

/** Open Graph card for a product: /og/<slug> */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = productBySlug(await getCatalogue(), slug);
  const font = await readFile(path.join(process.cwd(), 'assets/fonts/Anton-Regular.ttf'));
  const name = (p?.name ?? 'Pemart').toUpperCase();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#141414', color: '#F6F1E8', padding: 72, fontFamily: 'Anton' }}>
        <div style={{ fontSize: 40, letterSpacing: 6, color: '#E4D8C4', display: 'flex' }}>PEMART</div>
        <div style={{ fontSize: name.length > 24 ? 110 : 140, lineHeight: 1, display: 'flex' }}>{name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 44, color: '#E4D8C4' }}>
          <span style={{ display: 'flex' }}>WEAR WHAT YOU BELIEVE.</span>
          <span style={{ display: 'flex' }}>{p ? formatNaira(p.base_price_kobo) : ''}</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Anton', data: font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer, style: 'normal', weight: 400 }] },
  );
}
