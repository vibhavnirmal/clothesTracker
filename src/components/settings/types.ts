export type SettingsSection = 'overview' | 'clothingTypes' | 'materialTypes';

export interface SettingsProps {
  types: string[];
  materials: string[];
  onTypesUpdated: (types: string[]) => void;
  onMaterialsUpdated: (materials: string[]) => void;
  onBack?: () => void;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  typeUsage: Record<string, number>;
  onCreateClothing: () => void;
}
