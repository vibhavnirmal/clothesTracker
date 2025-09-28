import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Home, Plus, Waves, Check } from 'lucide-react';
import { ClothesCard } from './components/ClothesCard';
import { AddClothesModal } from './components/AddClothesModal';
import { WashClothes } from './components/WashClothes';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from './components/ui/navigation-menu';
import { Toaster } from './components/ui/sonner';
import type { AddClothesPayload, ClothesItem, WearRecord, WashRecord } from './types';
import { createClothes, fetchSnapshot, recordWash, recordWear, undoWear, updateClothes } from './lib/api';
import { getColorName } from './lib/colors';

type TabType = 'home' | 'add' | 'wash' | 'timeline';

const Timeline = lazy(async () => {
  const module = await import('./components/Timeline');
  return { default: module.Timeline };
});

const NAV_ITEMS: Array<{ id: TabType; icon: typeof Home; label: string }> = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'add', icon: Plus, label: 'Add' },
  { id: 'wash', icon: Waves, label: 'Wash' },
  { id: 'timeline', icon: Calendar, label: 'Timeline' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [clothes, setClothes] = useState<ClothesItem[]>([]);
  const [wearRecords, setWearRecords] = useState<WearRecord[]>([]);
  const [washRecords, setWashRecords] = useState<WashRecord[]>([]);
  const [selectedForWearing, setSelectedForWearing] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirmingOutfit, setIsConfirmingOutfit] = useState(false);
  const [editingClothes, setEditingClothes] = useState<ClothesItem | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const undoingWearIdsRef = useRef<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];

  const wearStatus = useMemo(() => {
    const status = new Map<string, { lastWearDate?: string; wornToday: boolean }>();

    wearRecords.forEach(record => {
      const current = status.get(record.clothesId);
      const isToday = record.date === today;

      if (!current) {
        status.set(record.clothesId, {
          lastWearDate: record.date,
          wornToday: isToday,
        });
        return;
      }

      if (record.date > (current.lastWearDate ?? '')) {
        status.set(record.clothesId, {
          lastWearDate: record.date,
          wornToday: isToday,
        });
      } else if (isToday && !current.wornToday) {
        status.set(record.clothesId, {
          lastWearDate: current.lastWearDate,
          wornToday: true,
        });
      }
    });

    return status;
  }, [wearRecords, today]);

  const availableTypes = useMemo(() => {
    const unique = new Set<string>();
    clothes.forEach(item => {
      if (item.type?.trim()) {
        unique.add(item.type.trim());
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [clothes]);

  const availableColors = useMemo(() => {
    const unique = new Map<string, { value: string; label: string }>();
    clothes.forEach(item => {
      if (!item.color) return;

      const normalized = item.color.trim().toUpperCase();
      if (!normalized) return;

      if (!unique.has(normalized)) {
        unique.set(normalized, {
          value: normalized,
          label: getColorName(item.color),
        });
      }
    });

    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [clothes]);

  useEffect(() => {
    if (typeFilter && !availableTypes.includes(typeFilter)) {
      setTypeFilter('');
    }
  }, [typeFilter, availableTypes]);

  useEffect(() => {
    if (colorFilter && !availableColors.some(option => option.value === colorFilter)) {
      setColorFilter('');
    }
  }, [colorFilter, availableColors]);

  const filteredClothes = useMemo(() => {
    return clothes.filter(item => {
      const matchesType = !typeFilter || item.type === typeFilter;
      const itemColor = item.color?.trim().toUpperCase() ?? '';
      const matchesColor = !colorFilter || itemColor === colorFilter;
      return matchesType && matchesColor;
    });
  }, [clothes, typeFilter, colorFilter]);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await fetchSnapshot();
      setClothes(snapshot.clothes);
      setWearRecords(snapshot.wearRecords);
      setWashRecords(snapshot.washRecords);
    } catch (err) {
      console.error('Failed to load clothes snapshot', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    setSelectedForWearing(prev => {
      const validIds = new Set(clothes.map(item => item.id));
      return new Set(
        Array.from(prev).filter(id => validIds.has(id) && !wearStatus.get(id)?.wornToday)
      );
    });
  }, [clothes, wearStatus]);

  useEffect(() => {
    setSelectedForWearing(prev => {
      let changed = false;
      const next = new Set(prev);

      Array.from(next).forEach(id => {
        if (wearStatus.get(id)?.wornToday) {
          next.delete(id);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [wearStatus]);

  const resetActionError = useCallback(() => setActionError(null), []);

  const getWearCountBadgeColor = (count: number) => {
    if (count <= 1) return 'bg-green-500';
    if (count <= 3) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleToggleClothes = useCallback(
    async (item: ClothesItem, nextChecked: boolean) => {
      const status = wearStatus.get(item.id);

      if (status?.wornToday) {
        if (nextChecked) {
          return;
        }

        if (undoingWearIdsRef.current.has(item.id)) {
          return;
        }

        resetActionError();
        undoingWearIdsRef.current.add(item.id);

        try {
          const { clothes: updatedClothes, wearRecords: updatedWearRecords } = await undoWear(item.id);
          setClothes(updatedClothes);
          setWearRecords(updatedWearRecords);
          setSelectedForWearing(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to undo wear';
          setActionError(message);
        } finally {
          undoingWearIdsRef.current.delete(item.id);
        }

        return;
      }

      setSelectedForWearing(prev => {
        const next = new Set(prev);
        if (nextChecked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
        return next;
      });
    },
    [wearStatus, resetActionError]
  );

  const handleAddClothes = useCallback(async (payload: AddClothesPayload) => {
    resetActionError();
    try {
      const created = await createClothes(payload);
      setClothes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add clothes';
      setActionError(message);
      throw err;
    }
  }, [resetActionError]);

  const handleUpdateClothes = useCallback(async (payload: AddClothesPayload) => {
    if (!editingClothes) return;

    resetActionError();
    try {
      const updated = await updateClothes(editingClothes.id, payload);
      setClothes(prev =>
        [...prev.map(item => (item.id === updated.id ? updated : item))].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setEditingClothes(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update clothes';
      setActionError(message);
      throw err;
    }
  }, [editingClothes, resetActionError]);

  const confirmTodaysOutfit = useCallback(async () => {
    const ids = Array.from(selectedForWearing);
    if (ids.length === 0) return;

    setIsConfirmingOutfit(true);
    resetActionError();

    try {
      const { clothes: updatedClothes, wearRecords: updatedWearRecords } = await recordWear(ids);
      setClothes(updatedClothes);
      setWearRecords(updatedWearRecords);
      setSelectedForWearing(new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm outfit';
      setActionError(message);
    } finally {
      setIsConfirmingOutfit(false);
    }
  }, [resetActionError, selectedForWearing]);

  const markAsWashed = useCallback(async (clothesIds: string[]) => {
    if (clothesIds.length === 0) return;

    resetActionError();

    try {
      const { clothes: updatedClothes, washRecords: updatedWashRecords } = await recordWash(clothesIds);
      setClothes(updatedClothes);
      setWashRecords(updatedWashRecords);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record wash event';
      setActionError(message);
      throw err;
    }
  }, [resetActionError]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div style={{ paddingBottom: '5rem' }}>
            <div className="pt-4 flex items-center justify-around">
              <div className="text-center text-xl font-semibold font-sans text-gray-700">
              What are you wearing today (
              {(() => {
                const d = new Date();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${mm}/${dd}`;
              })()})&nbsp;?
              </div>
            </div>
            <div className="p-4">
              <div className="relative w-full z-50 flex flex-wrap justify-around items-center rounded-sm mb-4" style={{ backgroundColor: 'rgba(87, 87, 87, 0.95)', padding: '0.5rem' }}>
                <div className="font-medium mr-2 text-white">
                  Filters: 
                </div>
                <div className="">
                  <Select
                    value={typeFilter || 'all'}
                    onValueChange={value => setTypeFilter(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger size="sm" className="min-w-[140px]">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {availableTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="">
                  <Select
                    value={colorFilter || 'all'}
                    onValueChange={value => setColorFilter(value === 'all' ? '' : value)}
                    disabled={availableColors.length === 0}
                  >
                    <SelectTrigger size="sm" className="min-w-[140px]">
                      <SelectValue placeholder="All colors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All colors</SelectItem>
                      {availableColors.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: option.value }}
                            />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredClothes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500">
                  No clothes match your current filters.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredClothes.map(item => {
                    const status = wearStatus.get(item.id);

                    return (
                      <ClothesCard
                        key={item.id}
                        item={item}
                        selected={selectedForWearing.has(item.id)}
                        onToggle={(nextChecked) => {
                          void handleToggleClothes(item, nextChecked);
                        }}
                        badgeColor={getWearCountBadgeColor(item.wearsSinceWash)}
                        wornToday={status?.wornToday ?? false}
                        lastWearDate={status?.lastWearDate}
                        onEdit={() => {
                          resetActionError();
                          setEditingClothes(item);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {selectedForWearing.size > 0 && (
              <div className="fixed right-2" style={{ bottom: '6.5rem' }}>
                  <Button
                    onClick={() => void confirmTodaysOutfit()}
                    className="rounded-none rounded-sm text-lg p-6"
                    style={{ whiteSpace: 'pre-line', backgroundColor: '#378a00ff', color: 'white' }}
                    disabled={isConfirmingOutfit}
                  >
                    {/* icon checkmark */}
                    {selectedForWearing.size === 1 ? "1 item" : `${selectedForWearing.size} items`}
                    <Check className="mr-2 inline-block h-4 w-4" />
                  </Button>
              </div>
            )}
          </div>
        );

      case 'add':
        return (
          <div className="p-4 pb-36">
            <AddClothesModal
              isOpen={true}
              onClose={() => setActiveTab('home')}
              onSubmit={handleAddClothes}
            />
          </div>
        );

      case 'wash':
        return (
          <WashClothes
            clothes={clothes}
            onMarkWashed={markAsWashed}
            onBack={() => setActiveTab('home')}
          />
        );

      case 'timeline':
        return (
          <Suspense
            fallback={(
              <div className="flex h-[calc(100vh-6rem)] items-center justify-center text-gray-600">
                Loading timeline...
              </div>
            )}
          >
            <Timeline
              clothes={clothes}
              wearRecords={wearRecords}
              washRecords={washRecords}
            />
          </Suspense>
        );

      default:
        return null;
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-[calc(100vh-6rem)] items-center justify-center text-gray-600">
          Loading your wardrobe...
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">{error}</p>
            <Button className="mt-4" onClick={() => void loadSnapshot()}>
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return (
      <>
        {actionError && (
          <div className="px-4 pt-4">
            <div className="relative rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
              <button
                type="button"
                className="absolute right-3 top-3 text-red-500 transition-colors hover:text-red-700"
                aria-label="Dismiss alert"
                onClick={resetActionError}
              >
                ×
              </button>
            </div>
          </div>
        )}
        {renderTabContent()}
      </>
    );
  };

  return (
    <div className="min-h-screen pb-28">
      <Toaster />
      {renderContent()}

      <AddClothesModal
        isOpen={Boolean(editingClothes)}
        onClose={() => setEditingClothes(null)}
        onSubmit={handleUpdateClothes}
        title="Edit Clothing"
        submitLabel="Save Changes"
        initialValues={editingClothes ? {
          name: editingClothes.name,
          type: editingClothes.type,
          color: editingClothes.color,
          image: editingClothes.image ?? '',
        } : undefined}
      />

      <nav className="fixed inset-x-0 w-full bottom-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <NavigationMenu className="w-full">
          <NavigationMenuList className="w-full px-2 py-2">
            {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
              const isActive = activeTab === id;

              return (
                <NavigationMenuItem key={id} className="flex-1">
                  <NavigationMenuLink asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab(id);
                        resetActionError();
                      }}
                      aria-label={label}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex w-full flex-col items-center gap-1 rounded-lg px-4 py-2 transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-xs">{label}</span>
                    </button>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>
      </nav>
    </div>
  );
}