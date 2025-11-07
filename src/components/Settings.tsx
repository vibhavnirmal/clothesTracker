import { useMemo, useState } from 'react';
import { CogIcon, Plus, Trash2, AlertTriangle, Pencil, Check } from 'lucide-react';
import { Button } from './ui/button';
import type { SettingsProps } from './settings/types';
import { ClothingTypesSection } from './settings/ClothingTypesSection';
import { MaterialTypesSection } from './settings/MaterialTypesSection';

export type { SettingsSection } from './settings/types';

export function Settings({
  types,
  materials,
  onTypesUpdated,
  onMaterialsUpdated,
  onBack,
  activeSection,
  onSectionChange,
  typeUsage,
  onCreateClothing,
  onPurgeDatabase,
  oldWearThresholdDays,
  onOldWearThresholdChange,
}: SettingsProps) {
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [tempThreshold, setTempThreshold] = useState(oldWearThresholdDays);
  const [justSaved, setJustSaved] = useState(false);

  // All hooks must be called before any conditional returns
  const sortedTypes = useMemo(() => [...types].sort((a, b) => a.name.localeCompare(b.name)), [types]);
  const sortedMaterials = useMemo(() => [...materials].sort((a, b) => a.localeCompare(b)), [materials]);

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      await onPurgeDatabase();
      setShowPurgeDialog(false);
    } finally {
      setIsPurging(false);
    }
  };

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

  if (activeSection === 'materialTypes') {
    return (
      <div className="pb-24">
        <div className="p-4">
          <MaterialTypesSection
            materials={materials}
            onMaterialsUpdated={onMaterialsUpdated}
            onBackToOverview={() => onSectionChange('overview')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="" style={{ paddingBottom: '5rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="p-4 space-y-6">
        {/* <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 mb-6">
            <div>
              <h1 className="flex items-center gap-2">
                <CogIcon className="h-5 w-5 text-blue-500 inline-block mr-1" />
                Settings
              </h1>
            </div>
          </div>
        </header> */}

        {/* <section className="rounded-xl border border-blue-100 bg-white p-4 mb-4">
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
        </section> */}

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

        <section className="rounded-xl border border-gray-100 bg-white p-4 mb-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Old Wear Threshold</h2>
              <p className="text-xs text-gray-500">
                Photos uploaded from more than this many days ago won't count toward "wears since wash".
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="old-wear-threshold" className="text-xs text-gray-700">
                Days threshold:
              </label>
              <div className="flex items-center gap-2">
                {isEditingThreshold ? (
                  <>
                    <input
                      id="old-wear-threshold"
                      type="number"
                      min="0"
                      max="365"
                      value={tempThreshold}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value) && value >= 0 && value <= 365) {
                          setTempThreshold(value);
                        }
                      }}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        onOldWearThresholdChange(tempThreshold);
                        setIsEditingThreshold(false);
                        setJustSaved(true);
                        setTimeout(() => setJustSaved(false), 2000);
                      }}                      
                      className="flex items-center gap-1 px-3 py-2 rounded-md text-xs font-medium"
                    >
                      <Check size={14} />
                      {justSaved ? 'Saved' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-900">{oldWearThresholdDays} days</span>
                    <button
                      onClick={() => {
                        setIsEditingThreshold(true);
                        setTempThreshold(oldWearThresholdDays);
                        setJustSaved(false);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                      title="Edit threshold"
                    >
                      <Pencil size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              Default: 10 days. Set to 0 to count all wears regardless of date.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 mb-4">
          <div className="flex flex-col gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Material types</h2>
              <p className="text-xs text-gray-500">
                Control the material options for clothing composition.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {sortedMaterials.length === 0
                  ? 'No material types configured yet.'
                  : `${sortedMaterials.length} material${sortedMaterials.length === 1 ? '' : 's'} available.`}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => onSectionChange('materialTypes')}>
                Manage materials
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-red-100 bg-red-50 p-4 mb-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </h2>
              <p className="text-xs text-red-700 mt-1">
                These actions cannot be undone. Proceed with caution.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Purge activity history</h3>
                  <p className="text-xs text-gray-500">
                    Delete all wear and wash records. Your clothes will remain but all history will be erased.
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setShowPurgeDialog(true)}
                  className="flex items-center gap-2"
                  disabled={isPurging}
                >
                  <Trash2 className="h-4 w-4" />
                  {isPurging ? 'Purging...' : 'Purge data'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {showPurgeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !isPurging && setShowPurgeDialog(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-2">Confirm Database Purge</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>This will permanently delete:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>All wear records (when you wore items)</li>
                    <li>All wash records (when you washed items)</li>
                    <li>Wear counters and last wash dates</li>
                  </ul>
                  <p className="font-semibold text-gray-900 mt-3">
                    Your clothing items will remain, but all activity history will be lost.
                  </p>
                  <p className="text-xs text-red-600 font-semibold mt-2">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPurgeDialog(false)}
                disabled={isPurging}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handlePurge}
                disabled={isPurging}
              >
                {isPurging ? 'Purging...' : 'Yes, purge all activity'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
