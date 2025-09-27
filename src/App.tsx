import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Home, Plus, Waves } from 'lucide-react';
import { ClothesCard } from './components/ClothesCard';
import { AddClothesModal } from './components/AddClothesModal';
import { WashClothes } from './components/WashClothes';
import { Button } from './components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from './components/ui/navigation-menu';
import { Toaster } from './components/ui/sonner';
import type { AddClothesPayload, ClothesItem, WearRecord, WashRecord } from './types';
import { createClothes, fetchSnapshot, recordWash, recordWear, undoWear, updateClothes } from './lib/api';

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
          <div style={{ paddingBottom: '9rem' }}>
            <div className="p-4 pb-36">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {clothes.map(item => {
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
            </div>

            {selectedForWearing.size > 0 && (
              <div className="mx-4">
                <div className="z-40 p-4 rounded-md bg-white border border-gray-200 shadow-lg">
                  <Button
                    onClick={() => void confirmTodaysOutfit()}
                    className="w-full"
                    disabled={isConfirmingOutfit}
                  >
                    Confirm Today's Outfit ({selectedForWearing.size} items)
                  </Button>
                </div>
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
    <div className="min-h-screen bg-gray-100 pb-28">
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