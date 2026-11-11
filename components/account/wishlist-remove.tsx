'use client';
import { useRouter } from 'next/navigation';
import { toggleWishlistAction } from '@/lib/actions/account';

export function WishlistRemove({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  return <button type="button" className="mt-1 min-h-11 text-sm font-semibold underline underline-offset-4" onClick={async () => { await toggleWishlistAction(productId); router.refresh(); }} aria-label={`Remove ${name} from wishlist`}>Remove</button>;
}
