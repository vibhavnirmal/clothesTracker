export interface ClothesItem {
  id: string;
  name: string;
  type: string;
  color: string;
  image?: string;
  dateOfPurchase?: string;
  wearsSinceWash: number;
  lastWashDate?: string;
  size?: string;
  materials?: Record<string, number>; // e.g., { "Cotton": 70, "Polyester": 30 }
  madeIn?: string;
  createdAt?: string;
}

export interface WearRecord {
  id: string;
  clothesId: string;
  date: string;
}

export interface WashRecord {
  id: string;
  clothesId: string;
  date: string;
}

export interface AppSnapshot {
  clothes: ClothesItem[];
  wearRecords: WearRecord[];
  washRecords: WashRecord[];
}

export interface AddClothesPayload {
  name: string;
  type: string;
  color: string;
  image?: string;
  dateOfPurchase?: string;
  size?: string;
  materials?: Record<string, number>;
  madeIn?: string;
}

export interface ClothingType {
  name: string;
  icon?: string | null;
}
