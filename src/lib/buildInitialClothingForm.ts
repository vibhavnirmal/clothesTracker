import type { AddClothesPayload } from '../types';

export function buildInitialClothingForm(values?: Partial<AddClothesPayload>): AddClothesPayload {
  return {
    name: values?.name ?? '',
    type: values?.type ?? '',
    color: values?.color ?? '',
    dateOfPurchase: values?.dateOfPurchase ?? '',
    image: values?.image ?? '',
    // New optional fields
    purchasePrice: values?.purchasePrice,
    brand: values?.brand,
    size: values?.size,
    material: values?.material,
    season: values?.season,
    careInstructions: values?.careInstructions,
    notes: values?.notes,
  };
}
