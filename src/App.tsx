import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Home, PieChart, Settings as SettingsIcon, Waves, Check, Search, X, Filter, ArrowUpDown, Plus } from 'lucide-react';
import { ClothesCard } from './components/ClothesCard';
import { AddClothesModal } from './components/AddClothesModal';
import { AddClothesPage } from './components/AddClothesPage';
import { getIconPath } from './lib/icons';
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
import type { AddClothesPayload, ClothesItem, WearRecord, WashRecord, ClothingType } from './types';
import {
	createClothes,
	fetchClothingTypes,
	fetchMaterialTypes,
	fetchSnapshot,
	recordWash,
	recordWear,
	undoWear,
	undoWash,
	updateClothes,
	purgeDatabase,
} from './lib/api';
import { getColorName } from './lib/colors';
import type { SettingsSection } from './components/Settings';
import {
	enqueueAction,
	getQueueLength,
	registerSync,
	replayQueue,
} from './lib/offlineQueue';

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

const NAV_ITEMS: Array<{ id: Exclude<TabType, 'settings'>; icon: typeof Home; label: string }> = [
	{ id: 'home', icon: Home, label: 'Home' },
	{ id: 'add', icon: Plus, label: 'Add' },
	{ id: 'wash', icon: Waves, label: 'Wash' },
	{ id: 'timeline', icon: Calendar, label: 'Timeline' },
	{ id: 'analysis', icon: PieChart, label: 'Analysis' },
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
	const [clothingTypes, setClothingTypes] = useState<ClothingType[]>([]);
	const [materialTypes, setMaterialTypes] = useState<string[]>([]);
	const [typeFilter, setTypeFilter] = useState('');
	const [colorFilter, setColorFilter] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [sortBy, setSortBy] = useState<'name' | 'mostWorn' | 'leastWorn' | 'needsWash'>('name');
	const [showFilters, setShowFilters] = useState(false);
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

	const handleTypesUpdated = useCallback((types: ClothingType[]) => {
		setClothingTypes(types);
	}, []);

	const handleMaterialsUpdated = useCallback((materials: string[]) => {
		setMaterialTypes(materials);
	}, []);

	const madeInLocations = useMemo(() => {
		const unique = new Set<string>();
		clothes.forEach(item => {
			if (item.madeIn && item.madeIn.trim().length > 0) {
				unique.add(item.madeIn.trim());
			}
		});
		return Array.from(unique).sort();
	}, [clothes]);

	const availableTypes = useMemo(() => {
		const unique = new Set<string>();
		clothes.forEach(item => {
			if (item.type?.trim()) {
				unique.add(item.type.trim());
			}
		});
		return Array.from(unique).sort((a, b) => a.localeCompare(b));
	}, [clothes]);

	const availableTypesForDropdown = useMemo(() => {
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

	// Top 10 color groups with counts
	const topColorGroups = useMemo(() => {
		// Define color groups with their shades
		const colorGroups = {
			'Black': ['#000000', '#36454F'], // Black, Charcoal
			'White': ['#FFFFFF', '#FFFDD0', '#FFFFF0', '#F5F5DC'], // White, Cream, Ivory, Beige
			'Gray': ['#808080', '#C0C0C0'], // Gray, Silver
			'Blue': ['#0000FF', '#000080', '#ADD8E6', '#87CEEB', '#1560BD'], // Blue, Navy, Light Blue, Sky Blue, Denim
			'Red': ['#FF0000', '#800000', '#FFC0CB', '#800020', '#FF7F50'], // Red, Maroon, Pink, Burgundy, Coral
			'Green': ['#008000', '#98FF98', '#00FF00', '#808000'], // Green, Mint, Lime, Olive
			'Yellow': ['#FFFF00', '#FFD700', '#FFDB58', '#F0E68C'], // Yellow, Gold, Mustard, Khaki
			'Purple': ['#800080', '#E6E6FA', '#FF00FF'], // Purple, Lavender, Magenta
			'Orange': ['#FFA500', '#FFDAB9'], // Orange, Peach
			'Brown': ['#A52A2A', '#D2B48C'], // Brown, Tan
			'Cyan': ['#00FFFF', '#008080', '#40E0D0'], // Cyan, Teal, Turquoise
		};

		// Count items per group
		const groupCounts = new Map<string, { count: number; representativeColor: string }>();
		
		Object.entries(colorGroups).forEach(([groupName, shades]) => {
			let count = 0;
			clothes.forEach(item => {
				if (typeFilter && item.type !== typeFilter) return;
				if (!item.color) return;
				const normalized = item.color.trim().toUpperCase();
				if (shades.includes(normalized)) {
					count++;
				}
			});
			if (count > 0) {
				groupCounts.set(groupName, { count, representativeColor: shades[0] });
			}
		});

		// Sort by count and take top 10
		return Array.from(groupCounts.entries())
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 10)
			.map(([name, { representativeColor }]) => ({ name, color: representativeColor }));
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
		if (colorFilter) {
			// Check if it's a valid color (either in availableColors or a color group representative)
			const isValidColor = availableColors.some(option => option.value === colorFilter);
			const isColorGroupRepresentative = topColorGroups.some(group => group.color === colorFilter);
			
			if (!isValidColor && !isColorGroupRepresentative) {
				setColorFilter('');
			}
		}
	}, [colorFilter, availableColors, topColorGroups]);

	const filteredClothes = useMemo(() => {
		// Color groups mapping for filtering
		const colorGroups: Record<string, string[]> = {
			'#000000': ['#000000', '#36454F'], // Black, Charcoal
			'#FFFFFF': ['#FFFFFF', '#FFFDD0', '#FFFFF0', '#F5F5DC'], // White, Cream, Ivory, Beige
			'#808080': ['#808080', '#C0C0C0'], // Gray, Silver
			'#0000FF': ['#0000FF', '#000080', '#ADD8E6', '#87CEEB', '#1560BD'], // Blue shades
			'#FF0000': ['#FF0000', '#800000', '#FFC0CB', '#800020', '#FF7F50'], // Red shades
			'#008000': ['#008000', '#98FF98', '#00FF00', '#808000'], // Green shades
			'#FFFF00': ['#FFFF00', '#FFD700', '#FFDB58', '#F0E68C'], // Yellow shades
			'#800080': ['#800080', '#E6E6FA', '#FF00FF'], // Purple shades
			'#FFA500': ['#FFA500', '#FFDAB9'], // Orange shades
			'#A52A2A': ['#A52A2A', '#D2B48C'], // Brown shades
			'#00FFFF': ['#00FFFF', '#008080', '#40E0D0'], // Cyan shades
		};

		return clothes.filter(item => {
			const matchesType = !typeFilter || item.type === typeFilter;
			const itemColor = item.color?.trim().toUpperCase() ?? '';
			
			// Check if color matches - either exact match or in the same group
			let matchesColor = !colorFilter;
			if (colorFilter && itemColor) {
				// Check if the filter color is a group representative
				const group = colorGroups[colorFilter];
				if (group) {
					matchesColor = group.includes(itemColor);
				} else {
					matchesColor = itemColor === colorFilter;
				}
			}

			// Search filter
			const matchesSearch = !searchQuery ||
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.type?.toLowerCase().includes(searchQuery.toLowerCase());

			return matchesType && matchesColor && matchesSearch;
		});
	}, [clothes, typeFilter, colorFilter, searchQuery]);

	const sortedClothes = useMemo(() => {
		const sorted = [...filteredClothes];

		// First, sort by the selected criteria
		switch (sortBy) {
			case 'mostWorn':
				sorted.sort((a, b) => b.wearsSinceWash - a.wearsSinceWash);
				break;
			case 'leastWorn':
				sorted.sort((a, b) => a.wearsSinceWash - b.wearsSinceWash);
				break;
			case 'needsWash':
				sorted.sort((a, b) => {
					// Items needing wash (3+) come first, then sort by wear count descending
					const aNeeds = a.wearsSinceWash >= 3 ? 1 : 0;
					const bNeeds = b.wearsSinceWash >= 3 ? 1 : 0;
					if (aNeeds !== bNeeds) return bNeeds - aNeeds;
					return b.wearsSinceWash - a.wearsSinceWash;
				});
				break;
			case 'name':
			default:
				sorted.sort((a, b) => a.name.localeCompare(b.name));
				break;
		}

		// Then, move items worn today to the top while maintaining their relative order
		return sorted.sort((a, b) => {
			const aWornToday = wearStatus.get(a.id)?.wornToday ?? false;
			const bWornToday = wearStatus.get(b.id)?.wornToday ?? false;
			
			if (aWornToday && !bWornToday) return -1;
			if (!aWornToday && bWornToday) return 1;
			return 0; // Maintain existing order for items in the same category
		});
	}, [filteredClothes, sortBy, wearStatus]);

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
							action.payload.date,
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

	const openManageTypes = useCallback(() => {
		setSettingsSection('clothingTypes');
		setActiveTab('settings');
		resetActionError();
	}, [resetActionError, setSettingsSection, setActiveTab]);

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

	const createAndStoreClothes = useCallback(async (payload: AddClothesPayload): Promise<ClothesItem> => {
		resetActionError();
		try {
			const created = await createClothes(payload);
			setClothes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
			return created;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to add clothes';
			setActionError(message);
			throw err;
		}
	}, [resetActionError, setClothes, setActionError]);

	const handleAddClothes = useCallback(async (payload: AddClothesPayload) => {
		await createAndStoreClothes(payload);
	}, [createAndStoreClothes]);

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

	const markAsWashed = useCallback(async (clothesIds: string[], date?: string) => {
		if (clothesIds.length === 0) return;

		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			const queue = enqueueAction({
				type: 'record-wash',
				payload: { clothesIds, queuedAt: Date.now(), date },
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
			const { clothes: updatedClothes, washRecords: updatedWashRecords } = await recordWash(clothesIds, date);
			setClothes(updatedClothes);
			setWashRecords(updatedWashRecords);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to record wash event';
			setActionError(message);
			throw err;
		}
	}, [registerSync, resetActionError]);

	const handlePurgeDatabase = useCallback(async () => {
		resetActionError();
		try {
			const { clothes: updatedClothes, wearRecords: updatedWearRecords, washRecords: updatedWashRecords } = await purgeDatabase();
			setClothes(updatedClothes);
			setWearRecords(updatedWearRecords);
			setWashRecords(updatedWashRecords);
			setSelectedForWearing(new Set());
			toast.success('Database purged successfully. All activity history has been deleted.');
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to purge database';
			setActionError(message);
			toast.error(message);
			throw err;
		}
	}, [resetActionError]);

	const handleAddToDate = useCallback(async (clothesIds: string[], date: string) => {
		resetActionError();
		const existingForDate = new Set(wearRecords.filter(record => record.date === date).map(record => record.clothesId));
		const uniqueIds = clothesIds.filter(id => !existingForDate.has(id));
		if (uniqueIds.length === 0) {
			toast.info('Those clothes are already logged for that day.');
			return;
		}

		try {
			const { clothes: updatedClothes, wearRecords: updatedWearRecords } = await recordWear(uniqueIds, date);
			setClothes(updatedClothes);
			setWearRecords(updatedWearRecords);

			const skipped = clothesIds.length - uniqueIds.length;
			const addedCount = uniqueIds.length;
			let message = `Added ${addedCount} item${addedCount === 1 ? '' : 's'} to ${date}`;
			if (skipped > 0) {
				message += ` (skipped ${skipped} already logged)`;
			}
			toast.success(message);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to add clothes to date';
			setActionError(message);
			toast.error(message);
			throw err;
		}
	}, [resetActionError, wearRecords]);

	const handleAddWashToDate = useCallback(async (clothesIds: string[], date: string) => {
		resetActionError();
		const existingForDate = new Set(washRecords.filter(record => record.date === date).map(record => record.clothesId));
		const uniqueIds = clothesIds.filter(id => !existingForDate.has(id));
		if (uniqueIds.length === 0) {
			toast.info('Those clothes are already marked as washed for that day.');
			return;
		}

		const skipped = clothesIds.length - uniqueIds.length;
		const wasOffline = typeof navigator !== 'undefined' && !navigator.onLine;

		try {
			await markAsWashed(uniqueIds, date);
			if (!wasOffline) {
				let message = `Marked ${uniqueIds.length} item${uniqueIds.length === 1 ? '' : 's'} as washed on ${date}`;
				if (skipped > 0) {
					message += ` (skipped ${skipped} already logged)`;
				}
				toast.success(message);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to mark clothes as washed for that date';
			setActionError(message);
			toast.error(message);
			throw err;
		}
	}, [resetActionError, washRecords, markAsWashed]);

	const handleRemoveWearFromDate = useCallback(async (clothesId: string, date: string) => {
		resetActionError();
		const removedItem = clothes.find(item => item.id === clothesId);
		try {
			const { clothes: updatedClothes, wearRecords: updatedWearRecords } = await undoWear(clothesId, date);
			setClothes(updatedClothes);
			setWearRecords(updatedWearRecords);
			if (date === today) {
				setSelectedForWearing(prev => {
					if (!prev.has(clothesId)) {
						return prev;
					}
					const next = new Set(prev);
					next.delete(clothesId);
					return next;
				});
			}
			const label = removedItem?.name ?? 'Wear record';
			toast.success(`Removed ${label} from ${date}.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to remove wear record';
			setActionError(message);
			toast.error(message);
			throw err;
		}
	}, [resetActionError, clothes, today]);

	const handleRemoveWashFromDate = useCallback(async (clothesId: string, date: string) => {
		resetActionError();
		const removedItem = clothes.find(item => item.id === clothesId);
		try {
			const { clothes: updatedClothes, washRecords: updatedWashRecords } = await undoWash(clothesId, date);
			setClothes(updatedClothes);
			setWashRecords(updatedWashRecords);
			const label = removedItem?.name ?? 'Wash record';
			toast.success(`Removed wash for ${label} on ${date}.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to remove wash record';
			setActionError(message);
			toast.error(message);
			throw err;
		}
	}, [resetActionError, clothes]);

	const handleBulkPhotoSubmit = useCallback(async (photos: Array<{ date: string | null; selectedClothesIds: string[] }>) => {
		resetActionError();
		let outfitsRecorded = 0;
		let itemsSkipped = 0;

		try {
			// Group photos by date
			const photosByDate = new Map<string, string[]>();
			
			photos.forEach(photo => {
				if (!photo.date) return;

				const existing = photosByDate.get(photo.date);
				if (existing) {
					existing.push(...photo.selectedClothesIds);
				} else {
					photosByDate.set(photo.date, [...photo.selectedClothesIds]);
				}
			});

			let currentWearRecords = wearRecords;

			// Record wear for each date
			for (const [date, clothesIds] of photosByDate.entries()) {
				const uniqueClothesIds = Array.from(new Set(clothesIds));
				const existingForDate = new Set(currentWearRecords.filter(record => record.date === date).map(record => record.clothesId));
				const idsToRecord = uniqueClothesIds.filter(id => !existingForDate.has(id));
				const skippedForDate = uniqueClothesIds.length - idsToRecord.length;
				itemsSkipped += skippedForDate;

				if (idsToRecord.length === 0) {
					continue;
				}

				const { clothes: updatedClothes, wearRecords: updatedWearRecords } = await recordWear(idsToRecord, date);
				setClothes(updatedClothes);
				setWearRecords(updatedWearRecords);
				currentWearRecords = updatedWearRecords;
				outfitsRecorded += 1;
			}

			if (outfitsRecorded > 0) {
				let message = `Recorded ${outfitsRecorded} outfit${outfitsRecorded === 1 ? '' : 's'} from photos`;
				if (itemsSkipped > 0) {
					message += ` (skipped ${itemsSkipped} already logged item${itemsSkipped === 1 ? '' : 's'})`;
				}
				toast.success(message + '!');
				setActiveTab('timeline');
			} else {
				toast.info('All selected items were already logged for those dates.');
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to submit photos';
			setActionError(message);
			toast.error(message);
			throw err;
		}
	}, [resetActionError, wearRecords]);

	const renderTabContent = () => {
		switch (activeTab) {
			case 'home':
				return (
					<div className="" style={{ paddingBottom: '5rem', maxWidth: '800px', margin: '0 auto' }}>
						{/* <div className="text-center px-2 text-xl font-semibold font-sans text-gray-700 mt-2">
							What are you wearing today (
							{(() => {
								const d = new Date();
								const mm = String(d.getMonth() + 1).padStart(2, '0');
								const dd = String(d.getDate()).padStart(2, '0');
								return `${mm}/${dd}`;
							})()})&nbsp;?
						</div> */}
						<div className="p-4">
							{/* Quick Type Filter Icons */}
							<div className="mb-3 overflow-x-auto scrollbar-hide">
								<div className="flex gap-2 pb-2">
									{clothingTypes
										.filter((type) => availableTypes.includes(type.name))
										.sort((a, b) => {
											const countA = clothingTypeUsage[a.name] || 0;
											const countB = clothingTypeUsage[b.name] || 0;
											return countB - countA; // Sort descending by count
										})
										.map((type) => {
										const isActive = typeFilter === type.name;
										return (
											<button
												key={type.name}
												onClick={() => setTypeFilter(isActive ? '' : type.name)}
												className={`
													flex items-center gap-1.5 rounded-md border-2 transition-all whitespace-nowrap
													${isActive 
														? 'border-blue-500 bg-blue-50 text-blue-700' 
														: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
													}
												`}
												title={type.name}
											>
												{type.icon ? (
													<div className="flex items-center gap-1">
														<img 
															src={getIconPath(type.icon) || ''}
															alt="" 
															className=""
															style={{ width: "40px", height: "40px", maxWidth: "75px", maxHeight: "75px", padding: "5px"}}
														/>
														<span></span>
													</div>
												) : (
													<span className="text-sm font-medium px-2">{type.name}</span>
												)}
											</button>
										);
									})}
								</div>
							</div>

							{/* Quick Color Filter */}
							{topColorGroups.length > 0 && (
								<div className="mb-3 overflow-x-auto scrollbar-hide">
									<div className="flex gap-2 pb-2">
										{topColorGroups.map((colorGroup) => {
											// Check if any shade in this group is active
											const isActive = colorFilter === colorGroup.color;
											return (
												<button
													key={colorGroup.name}
													onClick={() => setColorFilter(isActive ? '' : colorGroup.color)}
													className={`
														transition-all
														${isActive 
															? 'border-blue-500 bg-blue-50' 
															: 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
														}
													`}
													title={colorGroup.name}
												>
													<span
														className="block w-8 h-8 rounded-md border border-gray-300"
														style={{ backgroundColor: colorGroup.color }}
													/>
												</button>
											);
										})}
									</div>
								</div>
							)}
							
							{/* Compact Search and Filter Bar */}
							<div className="mb-3">
								{/* Search with Sort and Filter Button */}
								<div className="flex gap-2 mb-2">
									<div className="relative flex-1">
										<Search className="absolute right-2 top-2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
										<input
											type="text"
											placeholder="Search..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="w-full py-2 px-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
										/>
										{searchQuery && (
											<button
												onClick={() => setSearchQuery('')}
												className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
												aria-label="Clear search"
											>
												<X className="h-4 w-4" />
											</button>
										)}
									</div>
									
									{/* Clear Filters Button */}
									{(typeFilter || colorFilter) && (
										<button
											onClick={() => {
												setTypeFilter('');
												setColorFilter('');
											}}
											className="flex items-center gap-1 px-3 py-2 border rounded-lg transition-colors bg-white border-red-300 text-red-600 hover:bg-red-50"
											aria-label="Clear all filters"
										>
											<X className="h-4 w-4" />
											<span className="hidden sm:inline text-sm font-medium">Clear</span>
										</button>
									)}

									{/* Sort Dropdown */}
									<Select
										value={sortBy}
										onValueChange={(value) => setSortBy(value as typeof sortBy)}
									>
										<SelectTrigger className="w-[120px] sm:w-[140px]">
											<ArrowUpDown className="h-4 w-4 mr-1" />
											<span className="hidden sm:inline"><SelectValue /></span>
											<span className="sm:hidden text-xs"><SelectValue /></span>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="name">Name</SelectItem>
											<SelectItem value="mostWorn">Most Worn</SelectItem>
											<SelectItem value="leastWorn">Least Worn</SelectItem>
											<SelectItem value="needsWash">Needs Wash</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							{/* Results counter */}
							{(searchQuery || typeFilter || colorFilter) && (
								<div className="mb-3 text-xs text-gray-500 px-1">
									{sortedClothes.length} of {clothes.length} items
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
										const typeInfo = clothingTypes.find(t => t.name === item.type);

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
												typeIcon={typeInfo?.icon}
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
					<div style={{ paddingBottom: '5rem', maxWidth: '800px', margin: '0 auto' }}>
						<AddClothesPage
							typeOptions={clothingTypes}
							materialOptions={materialTypes}
							madeInOptions={madeInLocations}
							onSubmit={handleAddClothes}
							onCancel={() => {
								if (postAddRedirectTab === 'settings') {
									setSettingsSection('overview');
								}
								setActiveTab(postAddRedirectTab);
								resetActionError();
							}}
							onManageTypes={() => {
							openManageTypes();
						}}
							onSubmitSuccess={() => {
								if (postAddRedirectTab === 'settings') {
									setSettingsSection('overview');
								}
								setActiveTab(postAddRedirectTab);
								resetActionError();
							}}
						/>
					</div>
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
							onAddToDate={handleAddToDate}
							onAddWashToDate={handleAddWashToDate}
							onRemoveWear={handleRemoveWearFromDate}
							onRemoveWash={handleRemoveWashFromDate}
							onBulkPhotoSubmit={handleBulkPhotoSubmit}
							onCreateClothes={createAndStoreClothes}
							typeOptions={clothingTypes}
							materialOptions={materialTypes}
							madeInOptions={madeInLocations}
							onManageTypes={openManageTypes}
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
						key="settings"
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
							onPurgeDatabase={handlePurgeDatabase}
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
			
			{/* Top Header with Settings */}
				<div className="sticky top-0 z-20 bg-white">
					<div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#f2f2f2'}}>
						<h1 className="text-lg font-semibold text-gray-900">
							{activeTab === 'home' && 'My Wardrobe'}
							{activeTab === 'add' && 'Add Clothes'}
							{activeTab === 'wash' && 'Wash Clothes'}
							{activeTab === 'timeline' && 'Timeline'}
							{activeTab === 'analysis' && 'Analysis'}
							{activeTab === 'settings' && 'Settings'}
						</h1>
						{activeTab !== 'settings' && (
						<button
							onClick={() => {
								setSettingsSection('overview');
								setActiveTab('settings');
								resetActionError();
							}}
							className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
							aria-label="Settings"
						>
							<SettingsIcon className="w-5 h-5" />
						</button>
						)}

						{/* if settings page, show homepage button */}
						{activeTab === 'settings' && (
							<button
								onClick={() => {
									setSettingsSection('overview');
									setActiveTab('home');
									resetActionError();
								}}
								className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
								aria-label="Home"
							>
								<Home className="w-5 h-5" />
							</button>
							)}
					</div>
				</div>
			
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
					madeIn: editingClothes.madeIn,
				} : undefined}
				typeOptions={clothingTypes}
				materialOptions={materialTypes}
				madeInOptions={madeInLocations}
				onManageTypes={() => {
					setEditingClothes(null);
					setSettingsSection('clothingTypes');
					setActiveTab('settings');
					resetActionError();
				}}
			/>

			<nav className="fixed inset-x-0 w-full bottom-0 z-30 bg-white border-t border-gray-200 shadow-lg">
				<div 
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(5, 1fr)',
						gap: '4px',
						padding: '8px',
						maxWidth: '1280px',
						margin: '0 auto'
					}}
				>
					{NAV_ITEMS.map(({ id, icon: Icon, label }) => {
						const isActive = activeTab === id;

						return (
							<button
								key={id}
								type="button"
								onClick={() => {
									setActiveTab(id);
									resetActionError();
								}}
								aria-label={label}
								aria-current={isActive ? 'page' : undefined}
								style={{
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '6px',
									borderRadius: '8px',
									padding: '10px 8px',
									transition: 'all 0.2s',
									backgroundColor: isActive ? '#EFF6FF' : 'transparent',
									color: isActive ? '#2563EB' : '#4B5563',
									border: 'none',
									cursor: 'pointer',
								}}
								onMouseEnter={(e) => {
									if (!isActive) {
										e.currentTarget.style.backgroundColor = '#F9FAFB';
										e.currentTarget.style.color = '#1F2937';
									}
								}}
								onMouseLeave={(e) => {
									if (!isActive) {
										e.currentTarget.style.backgroundColor = 'transparent';
										e.currentTarget.style.color = '#4B5563';
									}
								}}
							>
								<Icon style={{ width: '24px', height: '24px', flexShrink: 0 }} />
								<span style={{ fontSize: '12px', fontWeight: '500', lineHeight: '1.25', textAlign: 'center' }}>
									{label}
								</span>
							</button>
						);
					})}
				</div>
			</nav>
		</div>
	);
}