export interface ClothesItem {
  id: string;
  name: string;
  type: string;
  color: string;
  image?: string;
  wearsSinceWash: number;
  lastWashDate?: string;
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
}
