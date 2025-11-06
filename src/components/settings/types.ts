import type { ClothingType } from '../../types';

export type SettingsSection = 'overview' | 'clothingTypes' | 'materialTypes';

export interface SettingsProps {
  types: ClothingType[];
  materials: string[];
  onTypesUpdated: (types: ClothingType[]) => void;
  onMaterialsUpdated: (materials: string[]) => void;
  onBack?: () => void;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  typeUsage: Record<string, number>;
  onCreateClothing: () => void;
  onPurgeDatabase: () => void;
}
