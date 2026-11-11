import { colourHex, colourNeedsDarkInk } from '@/lib/colours';
import { cn } from '@/lib/utils';

export type MockupView = 'front' | 'back' | 'detail';

// Silhouettes drawn on a 400x500 canvas. Art boxes are [x, y, w, h] in the same units.
const SHAPES = {
  tee: {
    body: 'M150 62 Q200 92 250 62 L330 92 L372 178 L316 202 L295 168 L295 440 L105 440 L105 168 L84 202 L28 178 L70 92 Z',
    collarFront: 'M150 62 Q200 118 250 62 Q200 84 150 62 Z',
    collarBack: 'M150 62 Q200 84 250 62 Q200 74 150 62 Z',
    seams: ['M105 168 L112 440', 'M295 168 L288 440', 'M105 168 Q92 140 70 92', 'M295 168 Q308 140 330 92'],
    back: [120, 118, 160, 192], front: [219, 112, 64, 32], detailOrigin: '50% 38%',
  },
  hoodie: {
    body: 'M140 66 Q200 22 260 66 L338 96 L382 336 L324 352 L298 196 L298 456 L102 456 L102 196 L76 352 L18 336 L62 96 Z',
    collarFront: 'M146 64 Q200 150 254 64 Q200 30 146 64 Z',
    collarBack: 'M136 68 Q200 -6 264 68 Q244 128 200 142 Q156 128 136 68 Z',
    pocket: 'M138 350 L262 350 L284 424 L116 424 Z',
    seams: ['M102 196 L108 456', 'M298 196 L292 456', 'M102 196 Q90 150 62 96', 'M298 196 Q310 150 338 96'],
    back: [112, 150, 176, 211], front: [219, 128, 64, 32], detailOrigin: '50% 40%',
  },
} as const;

function GarmentSvg({ type, colour, view }: { type: 'tee' | 'hoodie'; colour: string; view: 'front' | 'back' }) {
  const s = SHAPES[type];
  const fill = colourHex(colour);
  const id = `${type}-${colour.replace(/\W/g, '')}-${view}`;
  return (
    <svg viewBox="0 0 400 500" className="absolute inset-0 size-full" role="img" aria-label={`${colour} ${type}, ${view} view`}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="474" rx="150" ry="10" fill="#000" opacity="0.08" />
      <path d={s.body} fill={fill} />
      <path d={s.body} fill={`url(#g-${id})`} />
      {s.seams.map((d) => (<path key={d} d={d} stroke="#000" strokeOpacity="0.12" strokeWidth="2" fill="none" />))}
      <path d={view === 'front' ? s.collarFront : s.collarBack} fill="#000" fillOpacity={type === 'hoodie' ? 0.28 : 0.22} />
      {type === 'hoodie' && view === 'front' && (<path d={(s as typeof SHAPES.hoodie).pocket} fill="#000" fillOpacity="0.1" stroke="#000" strokeOpacity="0.16" strokeWidth="2" />)}
      <path d={s.body} fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="2" />
    </svg>
  );
}

/** Design artwork placed on a garment. Dark ink on light garments (Sand), cream ink otherwise. */
export function GarmentMockup({
  type, colour, view, designSlug, className, children, priority,
}: { type: 'tee' | 'hoodie'; colour: string; view: MockupView; designSlug: string | null; className?: string; children?: React.ReactNode; priority?: boolean }) {
  const base: 'front' | 'back' = view === 'front' ? 'front' : 'back';
  const s = SHAPES[type];
  const [x, y, w, h] = base === 'back' ? s.back : s.front;
  const dark = colourNeedsDarkInk(colour);
  const zoomed = view === 'detail';
  return (
    <div className={cn('relative aspect-[4/5] overflow-hidden bg-[#ece3d2]', className)}>
      <div className="absolute inset-0 transition-transform duration-200" style={zoomed ? { transform: 'scale(2.15)', transformOrigin: s.detailOrigin } : undefined}>
        <GarmentSvg type={type} colour={colour} view={base} />
        {children ? (
          // Custom content (the design studio) is laid out inside the print area. cqw units scale text to the area.
          <div className="absolute overflow-hidden" style={{ left: `${(x / 400) * 100}%`, top: `${(y / 500) * 100}%`, width: `${(w / 400) * 100}%`, height: `${(h / 500) * 100}%`, containerType: 'inline-size' }}>{children}</div>
        ) : designSlug && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/designs/${designSlug}-${base}.svg`}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className="absolute"
            style={{ left: `${(x / 400) * 100}%`, top: `${(y / 500) * 100}%`, width: `${(w / 400) * 100}%`, height: `${(h / 500) * 100}%`, filter: dark ? 'invert(1) brightness(0.9)' : undefined, opacity: 0.97 }}
          />
        )}
      </div>
    </div>
  );
}

/** A framed print: the design card behind a mat, in a black or wood frame. */
export function FrameMockup({ designSlug, finish = 'Black', className, priority }: { designSlug: string | null; finish?: string; className?: string; priority?: boolean }) {
  const wood = finish.toLowerCase() === 'wood';
  return (
    <div className={cn('relative aspect-[4/5] overflow-hidden bg-[#ece3d2]', className)}>
      <div className="absolute inset-[14%] shadow-[0_18px_30px_-14px_rgba(0,0,0,.45)]" style={{ background: wood ? 'linear-gradient(135deg,#b98c5a,#8f6738)' : '#141414', padding: '5%' }}>
        <div className="size-full bg-[#f6f1e8] p-[7%]">
          {designSlug && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/designs/${designSlug}-card.svg`} alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" className="size-full object-cover" />
          )}
        </div>
      </div>
    </div>
  );
}
