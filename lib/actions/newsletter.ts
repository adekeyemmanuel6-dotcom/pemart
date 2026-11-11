'use server';
import { claimFirstOrderOffer, type OfferState } from './offer';

export type NewsletterState = OfferState;

/** Footer sign-up: records email + consent timestamp and issues the single-use 10% first-order code. */
export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  return claimFirstOrderOffer('footer', formData);
}
