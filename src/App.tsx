import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Home, PieChart, Settings as SettingsIcon, Waves, Check, Search, X, Filter, ArrowUpDown } from 'lucide-react';
import { ClothesCard } from './components/ClothesCard';
import { AddClothesModal } from './components/AddClothesModal';
import { AddClothesPage } from './components/AddClothesPage';
import { WashClothes } from './components/WashClothes';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from './components/ui/navigation-menu';
import { Toaster, toast } from './components/ui/sonner';
import type { AddClothesPayload, ClothesItem, WearRecord, WashRecord } from './types';
import {
  createClothes,
  fetchClothingTypes,
  fetchMaterialTypes,
  fetchSnapshot,
  recordWash,
  recordWear,
  undoWear,
  updateClothes,
} from './lib/api';
import { getColorName } from './lib/colors';
import type { SettingsSection } from './components/Settings';
import {
  enqueueAction,
  getQueueLength,
  registerSync,
  replayQueue,
} from './lib/offlineQueue';
import { InstallBanner } from './components/InstallBanner';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const INSTALL_DISMISS_KEY = 'clothes-tracker-install-dismissed';

function detectIsIos(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === 'macintel' && navigator.maxTouchPoints > 1)
  );
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const { matchMedia } = window;
  const isStandaloneMedia = typeof matchMedia === 'function'
    ? matchMedia('(display-mode: standalone)').matches
    : false;
  const navigatorAny = navigator as Navigator & { standalone?: boolean };
  return Boolean(isStandaloneMedia || navigatorAny.standalone);
}

type TabType = 'home' | 'add' | 'wash' | 'timeline' | 'analysis' | 'settings';

const Timeline = lazy(async () => {
  const module = await import('./components/Timeline');
  return { default: module.Timeline };
});

const Analysis = lazy(async () => {
  const module = await import('./components/Analysis');
  return { default: module.Analysis };
});

const SettingsPage = lazy(async () => import('./components/Settings'));

const NAV_ITEMS: Array<{ id: TabType; icon: typeof Home; label: string }> = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'wash', icon: Waves, label: 'Wash' },
  { id: 'timeline', icon: Calendar, label: 'Timeline' },
  { id: 'analysis', icon: PieChart, label: 'Analysis' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
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
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [showIosInstallPrompt, setShowIosInstallPrompt] = useState(false);
  const [editingClothes, setEditingClothes] = useState<ClothesItem | null>(null);
  const [clothingTypes, setClothingTypes] = useState<string[]>([]);
  const [materialTypes, setMaterialTypes] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'mostWorn' | 'leastWorn' | 'recentlyAdded' | 'needsWash'>('name');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('overview');
  const [postAddRedirectTab, setPostAddRedirectTab] = useState<TabType>('home');
  const undoingWearIdsRef = useRef<Set<string>>(new Set());
  const installStateHydratedRef = useRef(false);
  const queueRetryStateRef = useRef<{ timeoutId: number | null; attempt: number }>({
    timeoutId: null,
    attempt: 0,
  });
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Get today's date in local timezone (YYYY-MM-DD)
  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

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

  const loadClothingTypes = useCallback(async () => {
    try {
      const { types } = await fetchClothingTypes();
      setClothingTypes(types);
    } catch (err) {
      console.error('Failed to load clothing types', err);
    }
  }, []);

  const loadMaterialTypes = useCallback(async () => {
    try {
      const { materials } = await fetchMaterialTypes();
      setMaterialTypes(materials);
    } catch (err) {
      console.error('Failed to load material types', err);
    }
  }, []);

  const handleTypesUpdated = useCallback((types: string[]) => {
    setClothingTypes(types);
  }, []);

  const handleMaterialsUpdated = useCallback((materials: string[]) => {
    setMaterialTypes(materials);
  }, []);

  const availableTypes = useMemo(() => {
    const unique = new Set<string>();
    clothes.forEach(item => {
      // If color filter is active, only include types that have that color
      if (colorFilter) {
        const itemColor = item.color?.trim().toUpperCase() ?? '';
        if (itemColor !== colorFilter) return;
      }
      
      if (item.type?.trim()) {
        unique.add(item.type.trim());
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [clothes, colorFilter]);

  const availableColors = useMemo(() => {
    const unique = new Map<string, { value: string; label: string }>();
    clothes.forEach(item => {
      // If type filter is active, only include colors from that type
      if (typeFilter && item.type !== typeFilter) return;
      
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
  }, [clothes, typeFilter]);

  const clothingTypeUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    clothes.forEach(item => {
      const type = typeof item.type === 'string' ? item.type.trim() : '';
      if (!type) return;
      counts[type] = (counts[type] ?? 0) + 1;
    });
    return counts;
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
      
      // Search filter
      const matchesSearch = !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesType && matchesColor && matchesSearch;
    });
  }, [clothes, typeFilter, colorFilter, searchQuery]);

  const sortedClothes = useMemo(() => {
    const sorted = [...filteredClothes];
    
    switch (sortBy) {
      case 'mostWorn':
        return sorted.sort((a, b) => b.wearsSinceWash - a.wearsSinceWash);
      case 'leastWorn':
        return sorted.sort((a, b) => a.wearsSinceWash - b.wearsSinceWash);
      case 'needsWash':
        return sorted.sort((a, b) => {
          // Items needing wash (3+) come first, then sort by wear count descending
          const aNeeds = a.wearsSinceWash >= 3 ? 1 : 0;
          const bNeeds = b.wearsSinceWash >= 3 ? 1 : 0;
          if (aNeeds !== bNeeds) return bNeeds - aNeeds;
          return b.wearsSinceWash - a.wearsSinceWash;
        });
      case 'recentlyAdded':
        return sorted.sort((a, b) => {
          // Sort by createdAt if available, otherwise by dateOfPurchase, then by ID
          if (a.createdAt && b.createdAt) {
            return b.createdAt.localeCompare(a.createdAt);
          }
          if (a.createdAt) return -1;
          if (b.createdAt) return 1;
          
          if (a.dateOfPurchase && b.dateOfPurchase) {
            return b.dateOfPurchase.localeCompare(a.dateOfPurchase);
          }
          if (a.dateOfPurchase) return -1;
          if (b.dateOfPurchase) return 1;
          
          return b.id.localeCompare(a.id);
        });
      case 'name':
      default:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [filteredClothes, sortBy]);

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

  const flushQueuedActions = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const retryState = queueRetryStateRef.current;

    const clearScheduledRetry = () => {
      if (retryState.timeoutId !== null) {
        window.clearTimeout(retryState.timeoutId);
        retryState.timeoutId = null;
      }
      retryState.attempt = 0;
      setNextRetryAt(null);
      setRetryCountdown(null);
    };

    const pendingBeforeFlush = getQueueLength();
    if (pendingBeforeFlush === 0) {
      setPendingSyncCount(0);
      clearScheduledRetry();
      return;
    }

    setIsSyncingQueue(true);

    try {
      await replayQueue(async action => {
        switch (action.type) {
          case 'record-wear': {
            const { clothes: updatedClothes, wearRecords: updatedWearRecords } = await recordWear(
              action.payload.clothesIds,
            );
            setClothes(updatedClothes);
            setWearRecords(updatedWearRecords);
            break;
          }
          case 'record-wash': {
            const { clothes: updatedClothes, washRecords: updatedWashRecords } = await recordWash(
              action.payload.clothesIds,
            );
            setClothes(updatedClothes);
            setWashRecords(updatedWashRecords);
            break;
          }
          default:
            break;
        }
      });

      setPendingSyncCount(getQueueLength());

      if (pendingBeforeFlush > 0) {
        toast.success('Offline activity synced');
      }

      clearScheduledRetry();
    } catch (err) {
      console.error('[offline-sync] failed to flush queue', err);
      setPendingSyncCount(getQueueLength());

      retryState.attempt += 1;
      const delay = Math.min(30000, 5000 * 2 ** (retryState.attempt - 1));

      if (retryState.timeoutId !== null) {
        window.clearTimeout(retryState.timeoutId);
      }

      const nextAttemptAt = Date.now() + delay;
      setNextRetryAt(nextAttemptAt);

      retryState.timeoutId = window.setTimeout(() => {
        retryState.timeoutId = null;
        setNextRetryAt(null);
        setRetryCountdown(null);
        void flushQueuedActions();
      }, delay);

      const seconds = Math.ceil(delay / 1000);
      toast.error(`Failed to sync offline activity. Retrying in ${seconds}s.`);
      registerSync();
    } finally {
      setIsSyncingQueue(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setPendingSyncCount(getQueueLength());

    const updateStatus = () => {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setIsOffline(offline);
      if (!offline) {
        void flushQueuedActions();
      }
    };

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, [flushQueuedActions]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'clothes-tracker:sync') {
        void flushQueuedActions();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [flushQueuedActions]);

  useEffect(() => {
    if (nextRetryAt === null) {
      setRetryCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const diff = nextRetryAt - Date.now();
      if (diff <= 0) {
        setRetryCountdown(null);
      } else {
        setRetryCountdown(Math.ceil(diff / 1000));
      }
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [nextRetryAt]);

  useEffect(() => {
    return () => {
      const state = queueRetryStateRef.current;
      if (state.timeoutId !== null) {
        window.clearTimeout(state.timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(INSTALL_DISMISS_KEY) === 'true';
      if (dismissed) {
        setInstallBannerDismissed(true);
      }
    } catch (error) {
      console.error('[install-banner] failed to read dismissal flag', error);
    }

    const evaluateStandalone = () => {
      const standalone = detectStandalone();
      if (standalone) {
        setInstallPromptEvent(null);
        setShowIosInstallPrompt(false);
        setInstallBannerDismissed(true);
      }
    };

    evaluateStandalone();

    const isiOS = detectIsIos();
    if (!dismissed && isiOS && !detectStandalone()) {
      setShowIosInstallPrompt(true);
    }

    installStateHydratedRef.current = true;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (dismissed || detectStandalone()) {
        return;
      }
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setShowIosInstallPrompt(false);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setShowIosInstallPrompt(false);
      setInstallBannerDismissed(true);
      try {
        window.localStorage.setItem(INSTALL_DISMISS_KEY, 'true');
      } catch (error) {
        console.error('[install-banner] failed to persist install flag', error);
      }
      toast.success('Clothes Tracker is ready from your home screen.');
    };

    const matchMediaStandalone = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = () => evaluateStandalone();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (matchMediaStandalone && typeof matchMediaStandalone.addEventListener === 'function') {
      matchMediaStandalone.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (matchMediaStandalone && typeof matchMediaStandalone.removeEventListener === 'function') {
        matchMediaStandalone.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!installStateHydratedRef.current) {
      return;
    }

    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, installBannerDismissed ? 'true' : 'false');
    } catch (error) {
      console.error('[install-banner] failed to persist dismissal', error);
    }
  }, [installBannerDismissed]);

  useEffect(() => {
    if (installBannerDismissed) {
      setShowIosInstallPrompt(false);
      setInstallPromptEvent(null);
    }
  }, [installBannerDismissed]);

  const handleDismissInstall = useCallback(() => {
    setInstallBannerDismissed(true);
    setInstallPromptEvent(null);
    setShowIosInstallPrompt(false);
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!installPromptEvent) {
      return;
    }

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        toast.success('Installing Clothes Tracker…');
      } else {
        toast.info('Installation canceled. You can install later from your browser menu.');
      }
    } catch (error) {
      console.error('[install-banner] install prompt failed', error);
      toast.error('Unable to start installation. Try using your browser menu.');
    } finally {
      setInstallPromptEvent(null);
      setInstallBannerDismissed(true);
    }
  }, [installPromptEvent]);

  useEffect(() => {
    void loadSnapshot();
    void loadClothingTypes();
    void loadMaterialTypes();
  }, [loadSnapshot, loadClothingTypes, loadMaterialTypes]);

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

  useEffect(() => {
    if (activeTab === 'settings') {
      void loadClothingTypes();
      void loadMaterialTypes();
    }
  }, [activeTab, loadClothingTypes, loadMaterialTypes]);

  const resetActionError = useCallback(() => setActionError(null), []);

  const openAddPage = useCallback((redirectTab: TabType) => {
    setPostAddRedirectTab(redirectTab);
    setActiveTab('add');
    resetActionError();
  }, [resetActionError]);

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

        const shouldUndoWear = typeof window === 'undefined'
          ? true
          : window.confirm('Do you want to mark it not worn today?');

        if (!shouldUndoWear) {
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

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queue = enqueueAction({
        type: 'record-wear',
        payload: { clothesIds: ids, queuedAt: Date.now() },
      });
      setSelectedForWearing(new Set());
      setPendingSyncCount(queue.length);
      toast.info(
        `Queued today's outfit (${ids.length} item${ids.length === 1 ? '' : 's'}) for sync once you're online.`,
      );
      registerSync();
      return;
    }

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
  }, [registerSync, resetActionError, selectedForWearing]);

  const markAsWashed = useCallback(async (clothesIds: string[]) => {
    if (clothesIds.length === 0) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queue = enqueueAction({
        type: 'record-wash',
        payload: { clothesIds, queuedAt: Date.now() },
      });
      setPendingSyncCount(queue.length);
      toast.info(
        `Queued wash for ${clothesIds.length} item${clothesIds.length === 1 ? '' : 's'} to sync when you're back online.`,
      );
      registerSync();
      return;
    }

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
  }, [registerSync, resetActionError]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="" style={{ paddingBottom: '5rem' }}>
            <div className="text-center px-2 text-xl font-semibold font-sans text-gray-700 mt-2">
              What are you wearing today (
              {(() => {
                const d = new Date();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${mm}/${dd}`;
              })()})&nbsp;?
            </div>
            <div className="p-4">
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name or type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{paddingRight: '10px', paddingLeft: '10px'}}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      style={{ top: '12px' }}
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Filter & Sort Toolbar */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4" style={{ padding: '12px'}}>
                <div className="items-center"  style={{ paddingBottom: '12px' }}>
                  {/* Filter Section */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                      <Filter className="h-4 w-4" />
                      <span className="hidden sm:inline">Filter</span>
                    </div>
                    <Select
                      value={typeFilter || 'all'}
                      onValueChange={value => setTypeFilter(value === 'all' ? '' : value)}
                    >
                      <SelectTrigger size="sm" className="min-w-[120px]">
                        <SelectValue placeholder="Type" />
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

                    <Select
                      value={colorFilter || 'all'}
                      onValueChange={value => setColorFilter(value === 'all' ? '' : value)}
                      disabled={availableColors.length === 0}
                    >
                      <SelectTrigger size="sm" className="min-w-[120px]">
                        <SelectValue placeholder="Color" />
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

                  {/* Divider */}
                  <div className="hidden sm:block h-6 w-px bg-gray-300" />

                  {/* Sort Section */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                      <ArrowUpDown className="h-4 w-4" />
                      <span className="hidden sm:inline">Sort</span>
                    </div>
                    <Select
                      value={sortBy}
                      onValueChange={(value) => setSortBy(value as typeof sortBy)}
                    >
                      <SelectTrigger size="sm" className="min-w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="mostWorn">Most Worn</SelectItem>
                        <SelectItem value="leastWorn">Least Worn</SelectItem>
                        <SelectItem value="needsWash">Needs Wash</SelectItem>
                        <SelectItem value="recentlyAdded">Recently Added</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters Button */}
                  {(typeFilter || colorFilter) && (
                    <div className="">
                      <div className="hidden sm:block h-6 w-px bg-gray-300" />
                      <button
                        onClick={() => {
                          setTypeFilter('');
                          setColorFilter('');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 rounded-md transition-colors"
                        aria-label="Clear filters"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Active Filters Chips */}
                {(typeFilter || colorFilter) && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200" style={{ paddingTop: '12px' }}>
                    <span className="text-xs text-gray-600 flex items-center align-center center">Active:</span>
                    {typeFilter && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {typeFilter}
                        <button
                          onClick={() => setTypeFilter('')}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                          aria-label={`Remove ${typeFilter} filter`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {colorFilter && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-purple-700 text-xs rounded-full">
                        <span
                          className="h-2 w-2 rounded-full border border-purple-300"
                          style={{ backgroundColor: colorFilter }}
                        />
                        <span className=''>
                        {availableColors.find(c => c.value === colorFilter)?.label || 'Color'}
                        </span>
                        <button
                          onClick={() => setColorFilter('')}
                          className="hover:bg-purple-200 rounded-full p-0.5"
                          aria-label="Remove color filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Results counter */}
              {(searchQuery || typeFilter || colorFilter) && (
                <div className="mb-3 text-sm text-gray-600">
                  Showing {sortedClothes.length} of {clothes.length} item{clothes.length !== 1 ? 's' : ''}
                </div>
              )}

              {sortedClothes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500">
                  {searchQuery || typeFilter || colorFilter 
                    ? 'No clothes match your current filters.' 
                    : 'No clothes yet. Add some to get started!'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {sortedClothes.map(item => {
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
                    style={{ backgroundColor: '#42882dee', color: 'white' }}
                    disabled={isConfirmingOutfit}
                  >
                    &nbsp;&nbsp;&nbsp;Confirm:
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
          <AddClothesPage
            typeOptions={clothingTypes}
            materialOptions={materialTypes}
            onSubmit={handleAddClothes}
            onCancel={() => {
              if (postAddRedirectTab === 'settings') {
                setSettingsSection('overview');
              }
              setActiveTab(postAddRedirectTab);
              resetActionError();
            }}
            onManageTypes={() => {
              setSettingsSection('clothingTypes');
              setActiveTab('settings');
              resetActionError();
            }}
            onSubmitSuccess={() => {
              if (postAddRedirectTab === 'settings') {
                setSettingsSection('overview');
              }
              setActiveTab(postAddRedirectTab);
              resetActionError();
            }}
          />
        );

      case 'wash':
        return (
          <WashClothes
            clothes={clothes}
            onMarkWashed={markAsWashed}
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

      case 'analysis':
        return (
          <Suspense
            fallback={(
              <div className="flex h-[calc(100vh-6rem)] items-center justify-center text-gray-600">
                Crunching wardrobe stats...
              </div>
            )}
          >
            <Analysis
              clothes={clothes}
              wearRecords={wearRecords}
              washRecords={washRecords}
            />
          </Suspense>
        );

      case 'settings':
        return (
          <Suspense
            fallback={(
              <div className="flex h-[calc(100vh-6rem)] items-center justify-center text-gray-600">
                Opening settings...
              </div>
            )}
          >
            <SettingsPage
              types={clothingTypes}
              materials={materialTypes}
              onTypesUpdated={handleTypesUpdated}
              onMaterialsUpdated={handleMaterialsUpdated}
              onBack={() => {
                setSettingsSection('overview');
                setActiveTab('analysis');
                resetActionError();
              }}
              activeSection={settingsSection}
              onSectionChange={setSettingsSection}
              typeUsage={clothingTypeUsage}
              onCreateClothing={() => openAddPage('settings')}
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
        {(isOffline || pendingSyncCount > 0 || isSyncingQueue) && (
          <div className="px-4 pt-4">
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <span>
                  {isOffline
                    ? 'Offline mode: queued actions will sync automatically when you reconnect.'
                    : isSyncingQueue
                      ? 'Syncing offline activity…'
                      : 'Offline activity waiting to sync.'}
                </span>
                {!isOffline && !isSyncingQueue && retryCountdown !== null && (
                  <span className="text-xs text-amber-700">
                    Retrying in approximately {retryCountdown}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {(pendingSyncCount > 0 || isSyncingQueue) && (
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {isSyncingQueue ? 'Syncing…' : `${pendingSyncCount} pending`}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void flushQueuedActions()}
                  disabled={isSyncingQueue || pendingSyncCount === 0 || isOffline}
                >
                  Retry now
                </Button>
              </div>
            </div>
          </div>
        )}
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
        title={`Edit ${editingClothes?.type}`}
        submitLabel="Save Changes"
        initialValues={editingClothes ? {
          name: editingClothes.name,
          type: editingClothes.type,
          color: editingClothes.color,
          dateOfPurchase: editingClothes.dateOfPurchase ?? '',
          image: editingClothes.image ?? '',
          size: editingClothes.size,
          materials: editingClothes.materials,
        } : undefined}
        typeOptions={clothingTypes}
        materialOptions={materialTypes}
        onManageTypes={() => {
          setEditingClothes(null);
          setSettingsSection('clothingTypes');
          setActiveTab('settings');
          resetActionError();
        }}
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
                        if (id === 'settings') {
                          setSettingsSection('overview');
                        }
                        if (id !== 'add') {
                          setPostAddRedirectTab('home');
                        }
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