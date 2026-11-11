'use server';
import { claimFirstOrderOffer, type OfferState } from './offer';

export async function claimPopupOffer(_prev: OfferState, formData: FormData): Promise<OfferState> {
  return claimFirstOrderOffer('popup', formData);
}
