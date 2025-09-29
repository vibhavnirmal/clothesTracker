import { useMemo } from 'react';
import { CogIcon, Plus } from 'lucide-react';
import { Button } from './ui/button';
import type { SettingsProps } from './settings/types';
import { ClothingTypesSection } from './settings/ClothingTypesSection';

export type { SettingsSection } from './settings/types';

export function Settings({
  types,
  onTypesUpdated,
  onBack,
  activeSection,
  onSectionChange,
  typeUsage,
  onCreateClothing,
}: SettingsProps) {
  if (activeSection === 'clothingTypes') {
    return (
      <div className="pb-24">
        <div className="p-4">
          <ClothingTypesSection
            types={types}
            onTypesUpdated={onTypesUpdated}
            onBackToOverview={() => onSectionChange('overview')}
            typeUsage={typeUsage}
          />
        </div>
      </div>
    );
  }

  const sortedTypes = useMemo(() => [...types].sort((a, b) => a.localeCompare(b)), [types]);

  return (
    <div className="pb-24">
      <div className="p-4 space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 mb-6">
            {/* {onBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onBack}
                aria-label="Back to analysis"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )} */}
            <div>
              <h1 className="flex items-center gap-2">
                <CogIcon className="h-5 w-5 text-blue-500 inline-block mr-1" />
                Settings
              </h1>
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-blue-100 bg-white p-4 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Add new clothing</h2>
              <p className="text-xs text-gray-500">
                Jump straight to the add clothing page whenever you need to log something new.
              </p>
            </div>
            <Button type="button" className="flex items-center gap-2" onClick={onCreateClothing}>
              <Plus className="h-4 w-4" />
              Add clothing
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 mb-4">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Clothing types</h2>
              <p className="text-xs text-gray-500">
                Control the clothing types available when logging new items.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {sortedTypes.length === 0
                  ? 'No clothing types configured yet.'
                  : `${sortedTypes.length} type${sortedTypes.length === 1 ? '' : 's'} available.`}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => onSectionChange('clothingTypes')}>
                Manage types
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
