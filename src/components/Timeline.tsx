import React, { useMemo, useState } from 'react';
import { Calendar, Shirt, Droplets, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ClothesItem, WearRecord, WashRecord } from '../types';
import { getColorName } from '../lib/colors';

const NEEDS_WASH_THRESHOLD = 4;

interface TimelineProps {
  clothes: ClothesItem[];
  wearRecords: WearRecord[];
  washRecords: WashRecord[];
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

export function Timeline({ clothes, wearRecords, washRecords }: TimelineProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterColor, setFilterColor] = useState<string>('all');

  // Get unique types and colors for filters
  const uniqueTypes = Array.from(new Set(clothes.map(c => c.type)));
  const uniqueColors = Array.from(new Set(clothes.map(c => c.color).filter(Boolean)));

  const { timeline, insights } = useMemo(() => {
    const matchesFilters = (item: ClothesItem) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterColor !== 'all' && item.color !== filterColor) return false;
      return true;
    };

    const clothesById = new Map(clothes.map(item => [item.id, item]));
    const filteredClothes = clothes.filter(matchesFilters);
    const filteredClothesIds = new Set(filteredClothes.map(item => item.id));

    const filteredWearRecords = wearRecords.filter(record => filteredClothesIds.has(record.clothesId));
    const filteredWashRecords = washRecords.filter(record => filteredClothesIds.has(record.clothesId));

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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
  }, [clothes, wearRecords, washRecords, filterType, filterColor]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const rangeLabel = useMemo(() => {
    if (timeline.length === 0) return '';

    const newest = new Date(timeline[0].date);
    const oldest = new Date(timeline[timeline.length - 1].date);
    const sameDay = newest.toDateString() === oldest.toDateString();
    const includeYear = newest.getFullYear() !== oldest.getFullYear();

    const format = (date: Date) =>
      date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(includeYear ? { year: 'numeric' } : {}),
      });

    if (sameDay) {
      return format(newest);
    }

    return `${format(oldest)} – ${format(newest)}`;
  }, [timeline]);

  const formatLastWash = (item: ClothesItem) => {
    if (!item.lastWashDate) {
      return 'No wash recorded yet';
    }

    return new Date(item.lastWashDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterColor('all');
  };

  return (
    <div style={{ paddingBottom: '70px' }}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h1>Timeline</h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 space-y-3 shadow-sm">
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
        </div>

        {/* Overview */}
        <div className="bg-white rounded-lg p-4 shadow-sm space-y-4">
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

          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Needs attention</p>
            {insights.needsWash.length > 0 ? (
              <div className="mt-2 space-y-2">
                {insights.needsWash.slice(0, 3).map(item => (
                  <div key={item.id} className="text-xs text-amber-800">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-amber-700/70"> • {item.wearsSinceWash} wear{item.wearsSinceWash !== 1 ? 's' : ''} since wash</span>
                    <span className="block text-[11px] text-amber-700/70">Color: {getColorName(item.color)}</span>
                    <span className="block text-[11px] text-amber-700/70">Last washed: {formatLastWash(item)}</span>
                  </div>
                ))}
                {insights.needsWash.length > 3 && (
                  <p className="text-[11px] text-amber-600/80">
                    +{insights.needsWash.length - 3} more item{insights.needsWash.length - 3 !== 1 ? 's' : ''} ready for a wash
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-700/70">Everything is fresh—no clothes need urgent attention.</p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {timeline.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No activity yet</p>
              <p className="text-sm text-gray-500">Start wearing and washing clothes to see your timeline!</p>
            </div>
          ) : (
            timeline.map(day => {
              const wearCount = day.wear.reduce((sum, entry) => sum + entry.count, 0);
              const washCount = day.wash.length;
              const dueSoon = day.wear.filter(entry => entry.item.wearsSinceWash >= NEEDS_WASH_THRESHOLD);

              return (
                <div key={day.date} className="bg-white rounded-xl p-4 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{formatDate(day.date)}</h3>
                      <p className="text-xs text-gray-500">
                        {wearCount} item{wearCount !== 1 ? 's' : ''} worn · {washCount} item{washCount !== 1 ? 's' : ''} washed
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {day.wear.length > 0 && (
                    <section className="space-y-2">
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="rounded-full bg-blue-100 p-1">
                          <Shirt className="h-3 w-3" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wide">Wore</p>
                      </div>
                      <div className="space-y-2">
                        {day.wear.map(({ item, count, total }) => (
                          <div key={item.id} className="rounded-lg border border-blue-50 bg-blue-50/60 px-3 py-2">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className="mt-1 h-3 w-3 rounded-full border border-gray-300"
                                  style={{ backgroundColor: item.color || '#e5e7eb' }}
                                />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {item.type} • worn {count} time{count !== 1 ? 's' : ''}
                                  </p>
                                  <p className="text-xs text-gray-500">Color: {getColorName(item.color)}</p>
                                  <p className="text-xs text-gray-500">Total wears: {total}</p>
                                  <p className="text-xs text-gray-400">
                                    Currently {item.wearsSinceWash} wear{item.wearsSinceWash !== 1 ? 's' : ''} since wash
                                  </p>
                                </div>
                              </div>
                              {item.wearsSinceWash >= NEEDS_WASH_THRESHOLD && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  Needs wash
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {day.wash.length > 0 && (
                    <section className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <div className="rounded-full bg-emerald-100 p-1">
                          <Droplets className="h-3 w-3" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wide">Washed</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {day.wash.map(item => (
                          <div key={item.id} className="min-w-[140px] flex-1 rounded-lg border border-emerald-50 bg-emerald-50/70 px-3 py-2">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.type}</p>
                            <p className="text-xs text-gray-400">Wear count reset</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {dueSoon.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Consider washing soon: {dueSoon.map(entry => entry.item.name).join(', ')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}