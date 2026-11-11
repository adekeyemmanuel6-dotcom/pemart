import Image from 'next/image';
import type { ProductType } from '@/lib/catalogue/types';
import { FrameMockup, GarmentMockup, type MockupView } from './garment-mockup';

export type VisualProps = {
  type: ProductType;
  designSlug: string | null;
  colour?: string | null;
  finish?: string | null;
  view?: MockupView;
  imageUrl?: string | null;   // real uploaded photo, or a type placeholder
  alt: string;
  sizes?: string;
  priority?: boolean;
};

const PLACEHOLDER: Partial<Record<ProductType, string>> = {
  perfume: 'perfume', bracelet: 'bracelet', jewellery: 'necklace', glasses: 'glasses', fun: 'orb', gift_card: 'gift-card', frame: 'frame',
};

/** The right picture for a product: garment mockup, framed print, uploaded photo, or a neutral placeholder. */
export function ProductVisual({ type, designSlug, colour, finish, view = 'front', imageUrl, alt, sizes = '(min-width:1024px) 25vw, 50vw', priority }: VisualProps) {
  if (!imageUrl && designSlug && (type === 'tee' || type === 'hoodie')) {
    return <GarmentMockup type={type} colour={colour ?? 'Black'} view={view} designSlug={designSlug} priority={priority} />;
  }
  if (!imageUrl && designSlug && type === 'frame') return <FrameMockup designSlug={designSlug} finish={finish ?? 'Black'} priority={priority} />;
  const src = imageUrl ?? `/placeholders/${PLACEHOLDER[type] ?? 'bundle'}.svg`;
  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-sand">
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
