import React, { useState } from 'react';
import { ArrowLeft, Droplets } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { toast } from './ui/sonner';
import { ImageWithFallback } from './ImageWithFallback';
import type { ClothesItem } from '../types';
import { differenceInCalendarDays, formatIsoDate, parseIsoDateToLocal, startOfToday } from '../lib/date';

interface WashClothesProps {
  clothes: ClothesItem[];
  onMarkWashed: (clothesIds: string[]) => Promise<void> | void;
  // onBack: () => void;
}

export function WashClothes({ clothes, onMarkWashed }: WashClothesProps) {
  const [selectedForWashing, setSelectedForWashing] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleWashSelection = (clothesId: string) => {
    setSelectedForWashing(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clothesId)) {
        newSet.delete(clothesId);
      } else {
        newSet.add(clothesId);
      }
      return newSet;
    });
  };

  const handleMarkWashed = async () => {
    const ids = Array.from(selectedForWashing);
    if (ids.length === 0) return;

    const unwornItems = ids
      .map(id => sortedClothes.find(item => item.id === id))
      .filter((item): item is ClothesItem => Boolean(item && item.wearsSinceWash === 0));

    if (unwornItems.length > 0) {
      const message = unwornItems.length === ids.length
        ? 'All selected clothes have never been worn. Do you still want to wash them?'
        : 'Some selected clothes have never been worn. Do you still want to wash them?';

      const confirmed = window.confirm(message);
      if (!confirmed) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onMarkWashed(ids);
      toast.success(`Marked ${ids.length} item${ids.length !== 1 ? 's' : ''} as washed`);
      setSelectedForWashing(new Set());
    } catch (err) {
      console.error('Failed to mark clothes as washed', err);
      toast.error('Failed to mark clothes as washed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getColorFromName = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-gray-500'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  const getBadgeColor = (count: number) => {
    if (count <= 1) return 'bg-green-500';
    if (count <= 3) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Sort clothes by wears since wash (highest first)
  const sortedClothes = [...clothes].sort((a, b) => b.wearsSinceWash - a.wearsSinceWash);

  const describeLastWash = (lastWashDate?: string) => {
    if (!lastWashDate) return 'Never washed yet';

    const parsedDate = parseIsoDateToLocal(lastWashDate);
    if (!parsedDate) {
      return `Last washed: ${formatIsoDate(lastWashDate, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    }

    const today = startOfToday();
    const diffDays = differenceInCalendarDays(parsedDate, today);

    if (diffDays <= 0) {
      return 'Last washed today';
    }

    if (diffDays < 30) {
      return diffDays === 1 ? 'Last washed 1 day ago' : `Last washed ${diffDays} days ago`;
    }

    const diffMonths = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;

    if (remainingDays === 0) {
      return diffMonths === 1 ? 'Last washed 1 month ago' : `Last washed ${diffMonths} months ago`;
    }

    const monthLabel = diffMonths === 1 ? '1 month' : `${diffMonths} months`;
    const dayLabel = remainingDays === 1 ? '1 day' : `${remainingDays} days`;
    return `Last washed ${monthLabel} ${dayLabel} ago`;
  };

  const NEEDS_WASH_THRESHOLD = 2;

  const selectNeedsWash = () => {
    const candidates = sortedClothes.filter(item => item.wearsSinceWash >= NEEDS_WASH_THRESHOLD);
    if (candidates.length === 0) {
      toast.info(`No clothes currently have ${NEEDS_WASH_THRESHOLD}+ wears since their last wash.`);
      return;
    }

    setSelectedForWashing(new Set(candidates.map(item => item.id)));
  };

  return (
    <div className="p-4"  style={{ paddingBottom: '5rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      {/* <div className="flex items-center gap-3 mb-6">
        <h1 className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-500" />
          Wash Clothes
        </h1>
      </div> */}

      {/* Quick select options */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={selectNeedsWash}
        >
          Select Needs Wash (2+)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedForWashing(new Set())}
        >
          Clear All
        </Button>
      </div>

      {/* Clothes grid */}
      <div className="grid grid-cols-2 mb-4 sm:grid-cols-3 gap-2">
        {sortedClothes.map(item => (
          <div
            key={item.id}
            className={`rounded-sm bg-white p-4 relative transition-all cursor-pointer ${
              selectedForWashing.has(item.id) ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => toggleWashSelection(item.id)}
          >
            {/* Wear count badge */}
            {item.wearsSinceWash >= 1 && (
              <div className={`absolute top-0 right-0 ${getBadgeColor(item.wearsSinceWash)} text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg`}>
                {item.wearsSinceWash}
              </div>
            )}

            {/* Checkbox */}
            <div className="absolute top-2 left-2">
              <Checkbox
                checked={selectedForWashing.has(item.id)}
                onCheckedChange={() => toggleWashSelection(item.id)}
              />
            </div>

            {/* Image or initials placeholder */}
            <div className="mb-3 mt-6">
              {item.image ? (
                <ImageWithFallback
                  src={item.image}
                  alt={item.name}
                  className="w-full h-28 object-cover rounded-sm"
                />
              ) : (
                <div 
                  className={`w-full h-28 rounded-lg flex items-center justify-center text-white text-xl ${getColorFromName(item.name)}`}
                  style={{ backgroundColor: item.color || undefined }}
                >
                  {getInitials(item.name)}
                </div>
              )}
            </div>

            {/* Clothes info */}
            <div className="space-y-1">
              <h3 className="text-sm truncate">{item.name}</h3>
              <p className="text-xs text-gray-600">{item.type}</p>
              <p className="text-xs text-gray-500">
                {describeLastWash(item.lastWashDate)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {clothes.length === 0 && (
        <div className="text-center py-12">
          <Droplets className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No clothes to wash yet</p>
          <p className="text-sm text-gray-500">Add some clothes first!</p>
        </div>
      )}

      {/* Action bar */}
      {selectedForWashing.size > 0 && (
        <div className="relative w-full z-40 m-4 p-4 bg-white border-t shadow-lg">
          <Button 
            onClick={handleMarkWashed}
            className="w-full"
            disabled={isSubmitting}
          >
            <Droplets className="w-4 h-4 mr-2" />
            Mark {selectedForWashing.size} item{selectedForWashing.size !== 1 ? 's' : ''} as Washed
          </Button>
        </div>
      )}
    </div>
  );
}