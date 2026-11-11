import { fitLines, type PrintDraft } from '@/lib/custom/draft';
import { TYPE_STYLES } from '@/lib/custom/tiers';

/**
 * What is printed inside the garment's print area. Sizes use cqw (container width units),
 * so the same markup scales from the big back print to the small chest mark.
 */
export function PrintArea({ draft, view, ink, fonts }: { draft: PrintDraft; view: 'front' | 'back'; ink: string; fonts: Record<string, string> }) {
  const style = TYPE_STYLES.find((t) => t.id === draft.typeStyle) ?? TYPE_STYLES[0];

  if (draft.tier === 'personalise') {
    if (!draft.designSlug) return <Ghost ink={ink} label="Pick a design" />;
    if (view === 'front') {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={`/designs/${draft.designSlug}-front.svg`} alt="" className="size-full object-contain" style={{ filter: ink === '#141414' ? 'invert(1) brightness(.9)' : undefined }} />;
    }
    return (
      <div className="flex size-full flex-col items-center justify-end" style={{ color: ink }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/designs/${draft.designSlug}-back.svg`} alt="" className="min-h-0 w-full flex-1 object-contain" style={{ filter: ink === '#141414' ? 'invert(1) brightness(.9)' : undefined }} />
        <div className="w-full pb-[1cqw] text-center leading-none">
          {draft.name && <div style={{ fontFamily: fonts.heavy, fontSize: '10cqw', textTransform: 'uppercase' }}>{draft.name}</div>}
          {draft.date && <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '5cqw', fontWeight: 600, letterSpacing: '0.18em', marginTop: '1cqw' }}>{draft.date.toUpperCase()}</div>}
          {draft.verse && <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '3.6cqw', fontWeight: 500, marginTop: '1.5cqw', lineHeight: 1.25 }}>{draft.verse}</div>}
        </div>
      </div>
    );
  }

  if (draft.tier === 'text_design') {
    const lines = fitLines(draft.textLines, draft.typeStyle, view);
    if (!lines.length) return <Ghost ink={ink} label={view === 'front' ? 'WORDS' : 'YOUR WORDS'} />;
    return (
      <div className="flex size-full flex-col items-center justify-center text-center" style={{ color: ink, fontFamily: fonts[style.id], fontWeight: style.weight, fontStyle: style.italic ? 'italic' : 'normal' }}>
        {lines.map((l, i) => (<div key={i} style={{ fontSize: `${l.size}cqw`, lineHeight: 1.06, whiteSpace: 'nowrap' }}>{l.text}</div>))}
      </div>
    );
  }

  // full custom: an uploaded image if we have one, otherwise a placeholder frame
  if (draft.uploadUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={draft.uploadUrl} alt="Your uploaded reference" className="size-full object-contain" />;
  }
  return <Ghost ink={ink} label={view === 'front' ? 'IDEA' : 'YOUR IDEA HERE'} dashed />;
}

function Ghost({ ink, label, dashed }: { ink: string; label: string; dashed?: boolean }) {
  return (
    <div className="grid size-full place-items-center text-center" style={{ color: ink, opacity: 0.5, border: dashed ? `0.8cqw dashed ${ink}` : undefined }}>
      <span style={{ fontFamily: 'var(--font-anton), Impact, sans-serif', fontSize: '12cqw', lineHeight: 1 }}>{label}</span>
    </div>
  );
}
