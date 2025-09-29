export type SettingsSection = 'overview' | 'clothingTypes';

export interface SettingsProps {
  types: string[];
  onTypesUpdated: (types: string[]) => void;
  onBack?: () => void;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  typeUsage: Record<string, number>;
  onCreateClothing: () => void;
}
