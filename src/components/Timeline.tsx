import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Shirt, Droplets, Filter, Plus, Upload, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { AddClothesPayload, ClothesItem, WearRecord, WashRecord, ClothingType } from '../types';
import { addDays, compareIsoDatesDesc, formatDateKey, formatIsoDate, parseIsoDateToLocal, startOfToday } from '../lib/date';
import { ImageWithFallback } from './ImageWithFallback';
import { AddToDateModal } from './AddToDateModal';
import { BulkPhotoUpload } from './BulkPhotoUpload';

const NEEDS_WASH_THRESHOLD = 4;

interface TimelineProps {
  clothes: ClothesItem[];
  wearRecords: WearRecord[];
  washRecords: WashRecord[];
  onAddToDate: (clothesIds: string[], date: string) => Promise<void>;
  onAddWashToDate: (clothesIds: string[], date: string) => Promise<void>;
  onBulkPhotoSubmit: (photos: Array<{ date: string | null; selectedClothesIds: string[] }>) => Promise<void>;
  onCreateClothes: (payload: AddClothesPayload) => Promise<ClothesItem>;
  onRemoveWear: (clothesId: string, date: string) => Promise<void>;
  onRemoveWash: (clothesId: string, date: string) => Promise<void>;
  typeOptions: ClothingType[];
  materialOptions: string[];
  madeInOptions: string[];
  onManageTypes?: () => void;
}

interface WearSummary {
  item: ClothesItem;
  count: number;
  total: number;
}

interface TimelineDay {
  date: string;
  wear: WearSummary[];
  wash: ClothesItem[];
}

export function Timeline({ clothes, wearRecords, washRecords, onAddToDate, onAddWashToDate, onBulkPhotoSubmit, onCreateClothes, onRemoveWear, onRemoveWash, typeOptions, materialOptions, madeInOptions, onManageTypes }: TimelineProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterColor, setFilterColor] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfToday());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [pendingWearRemoval, setPendingWearRemoval] = useState<{ item: ClothesItem; date: string } | null>(null);
  const [isRemovingWear, setIsRemovingWear] = useState(false);
  const [pendingWashRemoval, setPendingWashRemoval] = useState<{ item: ClothesItem; date: string } | null>(null);
  const [isRemovingWash, setIsRemovingWash] = useState(false);

  // Minimum swipe distance (in px) to trigger month change
  const minSwipeDistance = 50;

  // Get unique types and colors for filters
  const uniqueTypes = Array.from(new Set(clothes.map(c => c.type)));
  const uniqueColors = Array.from(new Set(clothes.map(c => c.color).filter(Boolean)));

  const { timeline, insights } = useMemo(() => {
    const matchesFilters = (item: ClothesItem) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterColor !== 'all' && item.color !== filterColor) return false;
      return true;
    };

    // Get the current month's date range
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDateStr = formatDateKey(startOfMonth);
    const endDateStr = formatDateKey(endOfMonth);

    const clothesById = new Map(clothes.map(item => [item.id, item]));
    const filteredClothes = clothes.filter(matchesFilters);
    const filteredClothesIds = new Set(filteredClothes.map(item => item.id));

    // Filter records by both clothes filter and current month
    const filteredWearRecords = wearRecords.filter(record => 
      filteredClothesIds.has(record.clothesId) && 
      record.date >= startDateStr && 
      record.date <= endDateStr
    );
    const filteredWashRecords = washRecords.filter(record => 
      filteredClothesIds.has(record.clothesId) &&
      record.date >= startDateStr && 
      record.date <= endDateStr
    );

    const wearCountMap = new Map<string, number>();
    filteredWearRecords.forEach(record => {
      wearCountMap.set(record.clothesId, (wearCountMap.get(record.clothesId) ?? 0) + 1);
    });

    const dayBuckets = new Map<string, { wear: Map<string, WearSummary>; wash: Map<string, ClothesItem> }>();

    const getBucket = (date: string) => {
      let bucket = dayBuckets.get(date);
      if (!bucket) {
        bucket = { wear: new Map(), wash: new Map() };
        dayBuckets.set(date, bucket);
      }
      return bucket;
    };

    filteredWearRecords.forEach(record => {
      const item = clothesById.get(record.clothesId);
      if (!item) return;
      const bucket = getBucket(record.date);
      const existing = bucket.wear.get(item.id);
      if (existing) {
        existing.count += 1;
      } else {
        bucket.wear.set(item.id, { item, count: 1, total: 1 });
      }
    });

    filteredWashRecords.forEach(record => {
      const item = clothesById.get(record.clothesId);
      if (!item) return;
      const bucket = getBucket(record.date);
      if (!bucket.wash.has(item.id)) {
        bucket.wash.set(item.id, item);
      }
    });

    const timelineDays: TimelineDay[] = Array.from(dayBuckets.entries())
      .map(([date, bucket]) => ({
        date,
        wear: Array.from(bucket.wear.values())
          .map(summary => ({
            ...summary,
            total: wearCountMap.get(summary.item.id) ?? summary.count,
          }))
          .sort((a, b) => a.item.name.localeCompare(b.item.name)),
        wash: Array.from(bucket.wash.values()).sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => compareIsoDatesDesc(a.date, b.date));

    let mostWornItem: { item: ClothesItem; count: number } | null = null;
    wearCountMap.forEach((count, id) => {
      const item = clothesById.get(id);
      if (!item) return;
      if (!mostWornItem || count > mostWornItem.count) {
        mostWornItem = { item, count };
      }
    });

    const needsWash = filteredClothes
      .filter(item => item.wearsSinceWash >= NEEDS_WASH_THRESHOLD)
      .sort((a, b) => b.wearsSinceWash - a.wearsSinceWash);

    return {
      timeline: timelineDays,
      insights: {
        totalWearCount: filteredWearRecords.length,
        totalWashCount: filteredWashRecords.length,
        mostWornItem: mostWornItem as { item: ClothesItem; count: number } | null,
        needsWash,
      } as {
        totalWearCount: number;
        totalWashCount: number;
        mostWornItem: { item: ClothesItem; count: number } | null;
        needsWash: ClothesItem[];
      },
    };
  }, [clothes, wearRecords, washRecords, filterType, filterColor, currentMonth]);

  const formatDate = (dateString: string) => {
    const date = parseIsoDateToLocal(dateString);
    if (!date) {
      return dateString;
    }

    const today = startOfToday();
    const yesterday = addDays(today, -1);

    if (date.getTime() === today.getTime()) {
      return 'Today';
    }

    if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const rangeLabel = useMemo(() => {
    if (timeline.length === 0) return '';

    const newest = parseIsoDateToLocal(timeline[0].date);
    const oldest = parseIsoDateToLocal(timeline[timeline.length - 1].date);

    if (!newest || !oldest) {
      return '';
    }

    const sameDay = newest.getTime() === oldest.getTime();
    const includeYear = newest.getFullYear() !== oldest.getFullYear();

    const formatOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' } : {}),
    };

    if (sameDay) {
      return formatIsoDate(timeline[0].date, formatOptions, 'en-US');
    }

    const rangeStart = formatIsoDate(timeline[timeline.length - 1].date, formatOptions, 'en-US');
    const rangeEnd = formatIsoDate(timeline[0].date, formatOptions, 'en-US');
    return `${rangeStart} – ${rangeEnd}`;
  }, [timeline]);

  const formatLastWash = (item: ClothesItem) => {
    if (!item.lastWashDate) {
      return 'No wash recorded yet';
    }

    return formatIsoDate(item.lastWashDate, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }, 'en-US');
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterColor('all');
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const calendarData = useMemo(() => {
    const activityMap = new Map<string, { wearCount: number; washCount: number }>();

    timeline.forEach(day => {
      const wearCount = day.wear.reduce((sum, entry) => sum + entry.count, 0);
      const washCount = day.wash.length;
      activityMap.set(day.date, { wearCount, washCount });
    });

    return activityMap;
  }, [timeline]);

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days: Array<{ date: Date; dateKey: string; isCurrentMonth: boolean }> = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: new Date(), dateKey: '', isCurrentMonth: false });
    }

    // Add days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      days.push({ date, dateKey: formatDateKey(date), isCurrentMonth: true });
    }

    return days;
  };

  const changeMonth = (offset: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    const today = startOfToday();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(formatDateKey(today));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      changeMonth(1); // Next month
    }
    if (isRightSwipe) {
      changeMonth(-1); // Previous month
    }
  };

  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return timeline.find(day => day.date === selectedDate);
  }, [selectedDate, timeline]);

  const wearIdsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const ids = wearRecords
      .filter(record => record.date === selectedDate)
      .map(record => record.clothesId);
    return Array.from(new Set(ids));
  }, [selectedDate, wearRecords]);

  const washIdsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const ids = washRecords
      .filter(record => record.date === selectedDate)
      .map(record => record.clothesId);
    return Array.from(new Set(ids));
  }, [selectedDate, washRecords]);

  const handleBulkUploadSubmit = useCallback(async (photos: Array<{ date: string | null; selectedClothesIds: string[] }>) => {
    await onBulkPhotoSubmit(photos);
    setShowBulkUpload(false);
  }, [onBulkPhotoSubmit]);

  const handleRequestWearRemoval = useCallback((item: ClothesItem, date: string) => {
    setPendingWearRemoval({ item, date });
  }, []);

  const handleCancelWearRemoval = useCallback(() => {
    if (isRemovingWear) {
      return;
    }
    setPendingWearRemoval(null);
  }, [isRemovingWear]);

  const handleConfirmWearRemoval = useCallback(async () => {
    if (!pendingWearRemoval) {
      return;
    }

    setIsRemovingWear(true);
    try {
      await onRemoveWear(pendingWearRemoval.item.id, pendingWearRemoval.date);
      setPendingWearRemoval(null);
    } catch (error) {
      console.error('Failed to remove wear record', error);
      alert('Failed to remove this wear record. Please try again.');
    } finally {
      setIsRemovingWear(false);
    }
  }, [pendingWearRemoval, onRemoveWear]);

  const handleRequestWashRemoval = useCallback((item: ClothesItem, date: string) => {
    setPendingWashRemoval({ item, date });
  }, []);

  const handleCancelWashRemoval = useCallback(() => {
    if (isRemovingWash) {
      return;
    }
    setPendingWashRemoval(null);
  }, [isRemovingWash]);

  const handleConfirmWashRemoval = useCallback(async () => {
    if (!pendingWashRemoval) {
      return;
    }

    setIsRemovingWash(true);
    try {
      await onRemoveWash(pendingWashRemoval.item.id, pendingWashRemoval.date);
      setPendingWashRemoval(null);
    } catch (error) {
      console.error('Failed to remove wash record', error);
      alert('Failed to remove this wash record. Please try again.');
    } finally {
      setIsRemovingWash(false);
    }
  }, [pendingWashRemoval, onRemoveWash]);

  useEffect(() => {
    if (!pendingWearRemoval) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isRemovingWear) {
          setPendingWearRemoval(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingWearRemoval, isRemovingWear]);

  useEffect(() => {
    if (!pendingWashRemoval) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isRemovingWash) {
          setPendingWashRemoval(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingWashRemoval, isRemovingWash]);

  if (showBulkUpload) {
    return (
      <div style={{ paddingBottom: '8rem', maxWidth: '800px', margin: '0 auto' }}>
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import From Photos</h2>
            <p className="text-sm text-gray-600">Tag outfits from your camera roll to backfill the timeline.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkUpload(false)}
          >
            Back to timeline
          </Button>
        </div>
        <BulkPhotoUpload
          clothes={clothes}
          onSubmit={handleBulkUploadSubmit}
          onAddClothes={onCreateClothes}
          typeOptions={typeOptions}
          materialOptions={materialOptions}
          madeInOptions={madeInOptions}
          onManageTypes={onManageTypes}
        />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '8rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="p-4 sm:p-4 space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-around sm:items-center justify-between gap-3 mb-6">
          {/* <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg sm:text-xl">Timeline</h1>
          </div> */}
          <div className="flex flex-row gap-1 justify-between">
            <div className="text-xs text-gray-500">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <Shirt className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-medium">{insights.totalWearCount}</span>
                <span className="text-gray-500 hidden sm:inline">worn</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600">
                <Droplets className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-medium">{insights.totalWashCount}</span>
                <span className="text-gray-500 hidden sm:inline">washed</span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center gap-1"
          >
            <Upload className="w-4 h-4" />
            <span className="text-xs sm:text-sm">Want to mark wears from old photos? Select Now</span>
          </Button>
        </div>

        {/* Filters */}
        {/* <div className="bg-white rounded-lg p-4 space-y-3 border-2 border-gray-200">
					<div className="flex items-center gap-2 mb-2">
						<Filter className="w-4 h-4 text-gray-600" />
						<span className="text-sm">Filters</span>
						{(filterType !== 'all' || filterColor !== 'all') && (
							<Button variant="ghost" size="sm" onClick={clearFilters}>
								Clear
							</Button>
						)}
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="text-xs text-gray-600 mb-1 block">Type</label>
							<Select value={filterType} onValueChange={setFilterType}>
								<SelectTrigger className="h-8">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									{uniqueTypes.map(type => (
										<SelectItem key={type} value={type}>{type}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<label className="text-xs text-gray-600 mb-1 block">Color</label>
							<Select value={filterColor} onValueChange={setFilterColor}>
								<SelectTrigger className="h-8">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Colors</SelectItem>
									{uniqueColors.map(color => (
										<SelectItem key={color} value={color}>
											<div className="flex items-center gap-2">
												<div
													className="w-3 h-3 rounded-full border border-gray-300"
													style={{ backgroundColor: color }}
												/>
												{color}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div> */}

        {/* Overview */}
        {/* <div className="bg-white p-2 space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-sm font-semibold text-gray-900">Activity overview</p>
							<p className="text-xs text-gray-500">
								Showing wardrobe activity that matches your filters.
							</p>
						</div>
						{rangeLabel && (
							<span className="text-xs text-gray-400">Range: {rangeLabel}</span>
						)}
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div className="rounded-xl border border-blue-50 bg-blue-50/60 p-4">
							<p className="text-xs uppercase tracking-wide text-blue-700">Wore</p>
							<p className="text-lg font-semibold text-blue-900">{insights.totalWearCount}</p>
							<p className="text-xs text-blue-700/70">Individual wear entries</p>
						</div>
						<div className="rounded-xl border border-emerald-50 bg-emerald-50/60 p-4">
							<p className="text-xs uppercase tracking-wide text-emerald-700">Washed</p>
							<p className="text-lg font-semibold text-emerald-900">{insights.totalWashCount}</p>
							<p className="text-xs text-emerald-700/70">Care events recorded</p>
						</div>
						<div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
							<p className="text-xs uppercase tracking-wide text-gray-500">Most worn item</p>
							{insights.mostWornItem ? (
								<>
									<p className="text-sm font-semibold text-gray-900">{insights.mostWornItem.item.name}</p>
									<p className="text-xs text-gray-500">
										{insights.mostWornItem.count} wear
										{insights.mostWornItem.count !== 1 ? 's' : ''} in this view
									</p>
								</>
							) : (
								<p className="text-xs text-gray-500">No wear activity yet.</p>
							)}
						</div>
					</div>
				</div> */}

        {/* Calendar View */}
        <div className="space-y-4 mb-8">
          {/* Quick Navigation - Year & Month Selection */}
          <div className="">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-gray-600 font-medium">Jump to:</span>
              <Select
                value={currentMonth.getMonth().toString()}
                onValueChange={(value) => {
                  const newMonth = new Date(currentMonth.getFullYear(), parseInt(value), 1);
                  setCurrentMonth(newMonth);
                  setSelectedDate(null);
                }}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">January</SelectItem>
                  <SelectItem value="1">February</SelectItem>
                  <SelectItem value="2">March</SelectItem>
                  <SelectItem value="3">April</SelectItem>
                  <SelectItem value="4">May</SelectItem>
                  <SelectItem value="5">June</SelectItem>
                  <SelectItem value="6">July</SelectItem>
                  <SelectItem value="7">August</SelectItem>
                  <SelectItem value="8">September</SelectItem>
                  <SelectItem value="9">October</SelectItem>
                  <SelectItem value="10">November</SelectItem>
                  <SelectItem value="11">December</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={currentMonth.getFullYear().toString()}
                onValueChange={(value) => {
                  const newMonth = new Date(parseInt(value), currentMonth.getMonth(), 1);
                  setCurrentMonth(newMonth);
                  setSelectedDate(null);
                }}
              >
                <SelectTrigger className="h-8 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => {
                    const year = new Date().getFullYear() - 5 + i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="h-8 text-xs"
              >
                Today
              </Button>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="bg-white rounded-lg p-3 sm:p-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>
                ←
              </Button>
              <h2 style={{ fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: '600', textAlign: 'center' }}>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>
                →
              </Button>
            </div>

            {/* Calendar Grid */}
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'clamp(2px, 0.5vw, 4px)', width: '100%' }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div
                  key={day}
                  style={{
                    textAlign: 'center',
                    fontSize: 'clamp(10px, 2.5vw, 12px)',
                    fontWeight: '600',
                    color: '#6B7280',
                    padding: 'clamp(4px, 1.5vw, 8px) 0'
                  }}
                >
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {generateCalendarDays().map((day, index) => {
                if (!day.isCurrentMonth) {
                  return <div key={`empty-${index}`} style={{ aspectRatio: '1', minHeight: 'clamp(50px, 12vw, 70px)' }} />;
                }

                const activity = calendarData.get(day.dateKey);
                const hasActivity = activity && (activity.wearCount > 0 || activity.washCount > 0);
                const isSelected = selectedDate === day.dateKey;
                const isToday = day.dateKey === formatDateKey(startOfToday());

                const getButtonStyle = () => {
                  const baseStyle: React.CSSProperties = {
                    aspectRatio: '1',
                    minHeight: 'clamp(50px, 12vw, 70px)',
                    padding: 'clamp(3px, 1vw, 6px)',
                    borderRadius: 'clamp(4px, 1.5vw, 8px)',
                    border: '1px solid',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 'clamp(2px, 0.5vw, 4px)',
                  };

                  if (isSelected) {
                    return {
                      ...baseStyle,
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      borderColor: '#3B82F6',
                    };
                  }

                  if (isToday) {
                    return {
                      ...baseStyle,
                      backgroundColor: '#EFF6FF',
                      borderColor: '#BFDBFE',
                      color: '#1E3A8A',
                      fontWeight: '600',
                    };
                  }

                  if (hasActivity) {
                    return {
                      ...baseStyle,
                      backgroundColor: '#F9FAFB',
                      borderColor: '#E5E7EB',
                    };
                  }

                  return {
                    ...baseStyle,
                    backgroundColor: 'white',
                    borderColor: '#F3F4F6',
                  };
                };

                return (
                  <button
                    key={day.dateKey}
                    onClick={() => setSelectedDate(day.dateKey)}
                    style={getButtonStyle()}
                    onMouseEnter={(e) => {
                      if (!isSelected && e.currentTarget) {
                        e.currentTarget.style.backgroundColor = isToday ? '#DBEAFE' : '#F3F4F6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && e.currentTarget) {
                        if (isToday) {
                          e.currentTarget.style.backgroundColor = '#EFF6FF';
                        } else if (hasActivity) {
                          e.currentTarget.style.backgroundColor = '#F9FAFB';
                        } else {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }
                    }}
                  >
                    <span style={{ color: isSelected ? 'white' : 'inherit', fontWeight: isToday ? '600' : 'normal' }}>
                      {day.date.getDate()}
                    </span>
                    {hasActivity && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'clamp(1px, 0.3vw, 2px)',
                        fontSize: 'clamp(8px, 2vw, 10px)',
                        lineHeight: '1',
                        width: '100%',
                        alignItems: 'center'
                      }}>
                        {activity.wearCount > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'clamp(2px, 0.5vw, 3px)',
                            color: isSelected ? 'white' : '#3B82F6',
                            fontWeight: '500'
                          }}>
                            <span style={{ fontSize: 'clamp(8px, 2vw, 10px)' }}>👕</span>
                            <span>{activity.wearCount > 99 ? '99+' : activity.wearCount}</span>
                          </div>
                        )}
                        {activity.washCount > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'clamp(2px, 0.5vw, 3px)',
                            color: isSelected ? 'white' : '#10B981',
                            fontWeight: '500'
                          }}>
                            <span style={{ fontSize: 'clamp(8px, 2vw, 10px)' }}>💧</span>
                            <span>{activity.washCount > 99 ? '99+' : activity.washCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Details */}
          {selectedDate && selectedDayData && (
            <div className="bg-white rounded-xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{formatDate(selectedDate)}</h3>
                  <p className="text-xs text-gray-500">
                    {formatIsoDate(selectedDate, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }, 'en-US')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(true)}
                    className="text-black cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                  <Button variant="outline" className='cursor-pointer' size="sm" onClick={() => setSelectedDate(null)}>
                    Close
                  </Button>
                </div>
              </div>

              {selectedDayData.wear.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Shirt className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Wore ({selectedDayData.wear.length})</p>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    {selectedDayData.wear.map(({ item, count }) => {
                      const dateForRemoval = selectedDate!;
                      const isPendingWearRemoval = pendingWearRemoval?.item.id === item.id && pendingWearRemoval.date === dateForRemoval;

                      return (
                        <div key={item.id} className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                          <div className="flex items-start gap-3">
                            {item.image ? (
                              <ImageWithFallback
                                src={item.image}
                                alt={item.name}
                                className="h-12 w-12 object-cover flex-shrink-0"
                                style={{ borderTopLeftRadius: '0.375rem', borderBottomLeftRadius: '0.375rem', border: '1px solid #D1D5DB' }}
                              />
                            ) : (
                              <div
                                className="h-12 w-12 flex items-center justify-center text-xs font-semibold flex-shrink-0"
                                style={{ backgroundColor: item.color || '#9CA3AF', border: '1px solid #D1D5DB', borderTopLeftRadius: '0.375rem', borderBottomLeftRadius: '0.375rem' }}
                              >
                                {item.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {item.type}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  className="flex flex-col items-center justify-center gap-1"
                                  style={{height: "max-content", paddingTop: "6px", paddingBottom: "6px"  }}
                                  onClick={() => handleRequestWearRemoval(item, dateForRemoval)}
                                  disabled={isRemovingWear && isPendingWearRemoval}
                                  aria-label={`Remove ${item.name} from ${formatDate(dateForRemoval)}`}
                                  title={`Remove ${item.name} from ${formatDate(dateForRemoval)}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="text-xs font-medium">Remove</span>
                                </Button>
                              </div>
                              {item.wearsSinceWash >= NEEDS_WASH_THRESHOLD && (
                                <span className="inline-block mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                  Needs wash
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {selectedDayData.wash.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Droplets className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">Washed ({selectedDayData.wash.length})</p>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    {selectedDayData.wash.map(item => {
                      const dateForRemoval = selectedDate!;
                      const isPendingWash = pendingWashRemoval?.item.id === item.id && pendingWashRemoval.date === dateForRemoval;

                      return (
                        <div key={item.id} className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                          <div className="flex items-start gap-3">
                            {item.image ? (
                              <ImageWithFallback
                                src={item.image}
                                alt={item.name}
                                className="h-12 w-12 rounded-md object-cover flex-shrink-0"
                                style={{ borderTopLeftRadius: '0.375rem', borderBottomLeftRadius: '0.375rem', border: '1px solid #D1D5DB' }}
                              />
                            ) : (
                              <div
                                className="h-12 w-12 rounded-md flex items-center justify-center text-xs font-semibold flex-shrink-0"
                                style={{ backgroundColor: item.color || '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}
                              >
                                {item.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                  <p className="text-xs text-gray-500">{item.type}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  className="flex flex-col items-center justify-center gap-1"
                                  style={{ height: 'max-content', paddingTop: '6px', paddingBottom: '6px' }}
                                  onClick={() => handleRequestWashRemoval(item, dateForRemoval)}
                                  disabled={isRemovingWash && isPendingWash}
                                  aria-label={`Remove wash for ${item.name} on ${formatDate(dateForRemoval)}`}
                                  title={`Remove wash for ${item.name} on ${formatDate(dateForRemoval)}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="text-xs font-medium">Remove</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {selectedDate && !selectedDayData && (
            <div className="bg-white rounded-lg">
              <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{formatDate(selectedDate)}</h3>
                  <p className="text-xs text-gray-500">
                    {formatIsoDate(selectedDate, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }, 'en-US')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddModal(true)}
                    className="text-black cursor-pointer"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                  <Button variant="outline" className='cursor-pointer' size="sm" onClick={() => setSelectedDate(null)}>
                    Close
                  </Button>
                </div>
              </div>
              <div className="p-4 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-base font-medium text-gray-700 mb-2">No activity on this day</p>
                <p className="text-sm text-gray-500">Click "Add" above to record clothes worn on this date</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add To Date Modal */}
      {showAddModal && selectedDate && (
        <AddToDateModal
          clothes={clothes}
          date={selectedDate}
          onAddWear={onAddToDate}
          onAddWash={onAddWashToDate}
          onClose={() => setShowAddModal(false)}
          disabledWearClothesIds={wearIdsForSelectedDate}
          disabledWashClothesIds={washIdsForSelectedDate}
        />
      )}

      {pendingWearRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleCancelWearRemoval}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-wear-title"
            aria-describedby="remove-wear-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="remove-wear-title" className="text-lg font-semibold text-gray-900">Remove from timeline?</h3>
            <p id="remove-wear-description" className="mt-2 text-sm text-gray-600">
              Remove <span className="font-semibold text-gray-900">{pendingWearRemoval.item.name}</span> from{' '}
              {formatIsoDate(pendingWearRemoval.date, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }, 'en-US')}?
            </p>
            <p className="mt-3 text-xs text-gray-500">
              This removes the wear record for that date and updates your stats accordingly.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelWearRemoval}
                disabled={isRemovingWear}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmWearRemoval}
                disabled={isRemovingWear}
              >
                {isRemovingWear ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingWashRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleCancelWashRemoval}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-wash-title"
            aria-describedby="remove-wash-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="remove-wash-title" className="text-lg font-semibold text-gray-900">Remove wash record?</h3>
            <p id="remove-wash-description" className="mt-2 text-sm text-gray-600">
              Remove wash record for <span className="font-semibold text-gray-900">{pendingWashRemoval.item.name}</span> on{' '}
              {formatIsoDate(pendingWashRemoval.date, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }, 'en-US')}?
            </p>
            <p className="mt-3 text-xs text-gray-500">
              This restores the previous wash stats for that clothing item.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelWashRemoval}
                disabled={isRemovingWash}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmWashRemoval}
                disabled={isRemovingWash}
              >
                {isRemovingWash ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}