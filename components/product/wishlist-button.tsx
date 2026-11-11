'use client';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { toggleWishlistAction, wishlistStatusAction } from '@/lib/actions/account';

/** Heart on the product page. Signed-in visitors save to their wishlist; others are sent to sign in first. */
export function WishlistButton({ productId, slug }: { productId: string; slug: string }) {
  const [on, setOn] = useState(false), [signedIn, setSignedIn] = useState<boolean | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { wishlistStatusAction(productId).then((r) => { setSignedIn(r.signedIn); setOn(r.on); }).catch(() => setSignedIn(false)); }, [productId]);
  const label = on ? 'Remove from wishlist' : 'Save to wishlist';
  if (signedIn === false) return <a href={`/auth/sign-in?next=${encodeURIComponent(`/products/${slug}`)}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"><Heart className="size-5" aria-hidden />Sign in to save</a>;
  return (
    <button type="button" aria-pressed={on} disabled={busy || signedIn === null} onClick={async () => { setBusy(true); const r = await toggleWishlistAction(productId); if (r.ok) setOn(!!r.on); setBusy(false); }}
      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><Heart className={`size-5 ${on ? 'fill-ember text-ember' : ''}`} aria-hidden />{label}</button>
  );
}
