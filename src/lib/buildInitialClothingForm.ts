import type { AddClothesPayload } from '../types';

export function buildInitialClothingForm(values?: Partial<AddClothesPayload>): AddClothesPayload {
  return {
    name: values?.name ?? '',
    type: values?.type ?? '',
    color: values?.color ?? '',
    dateOfPurchase: values?.dateOfPurchase ?? '',
    image: values?.image ?? '',
    size: values?.size,
    materials: values?.materials,
    madeIn: values?.madeIn,
  };
}
