export interface ClothesItem {
  id: string;
  name: string;
  type: string;
  color: string;
  image?: string;
  dateOfPurchase?: string;
  wearsSinceWash: number;
  lastWashDate?: string;
  // New optional fields for enhanced functionality
  purchasePrice?: number;
  brand?: string;
  size?: string;
  material?: string;
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'all';
  careInstructions?: string;
  status?: 'active' | 'donated' | 'sold' | 'storage';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WearRecord {
  id: string;
  clothesId: string;
  date: string;
  // New optional fields for enhanced functionality
  weatherTemp?: number;
  weatherCondition?: string;
  occasion?: 'work' | 'casual' | 'formal' | 'sport' | 'social' | 'travel';
  rating?: number; // 1-5 scale
  notes?: string;
  createdAt?: string;
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
  // New optional fields
  purchasePrice?: number;
  brand?: string;
  size?: string;
  material?: string;
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'all';
  careInstructions?: string;
  notes?: string;
}

// New interfaces for enhanced features
export interface Outfit {
  id: string;
  name: string;
  description?: string;
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'all';
  occasion?: 'work' | 'casual' | 'formal' | 'sport' | 'social' | 'travel';
  rating?: number; // 1-5 scale
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutfitItem {
  id: string;
  outfitId: string;
  clothesId: string;
  createdAt: string;
}

export interface OutfitWearRecord {
  id: string;
  outfitId: string;
  date: string;
  weatherTemp?: number;
  weatherCondition?: string;
  rating?: number;
  notes?: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

export interface ClothesTag {
  clothesId: string;
  tagId: string;
  createdAt: string;
}

export interface UserPreference {
  key: string;
  value: string;
  updatedAt: string;
}

export interface WeatherData {
  date: string;
  temperatureMin?: number;
  temperatureMax?: number;
  condition?: string;
  humidity?: number;
  precipitationChance?: number;
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  type: string;
  brand?: string;
  estimatedPrice?: number;
  priority: number; // 1-5 scale
  reason?: string;
  status: 'wanted' | 'purchased' | 'no_longer_needed';
  purchasedClothesId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  category?: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}
