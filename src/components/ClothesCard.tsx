import React from 'react';
import { Pencil } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { ImageWithFallback } from './ImageWithFallback';
import type { ClothesItem } from '../types';
import { getColorName } from '../lib/colors';

interface ClothesCardProps {
  item: ClothesItem;
  selected: boolean;
  onToggle: (nextChecked: boolean) => void;
  badgeColor: string;
  wornToday: boolean;
  lastWearDate?: string;
  onEdit?: () => void;
}

export function ClothesCard({
  item,
  selected,
  onToggle,
  badgeColor,
  wornToday,
  lastWearDate,
  onEdit,
}: ClothesCardProps) {
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

  const formatWearDate = (date: string) => {
    try {
      return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return date;
    }
  };

  const isChecked = selected || wornToday;

  const wearStatusLabel = wornToday
    ? 'Marked worn today (tap to undo)'
    : lastWearDate
      ? `Last worn: ${formatWearDate(lastWearDate)}`
      : 'Never worn yet';

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('[data-no-card-toggle]')) {
      return;
    }
    onToggle(!isChecked);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle(!isChecked);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-md p-4 relative transition-all ${
        selected ? 'ring-2 ring-blue-500' : ''
      } cursor-pointer`}
      role="button"
      tabIndex={0}
      aria-pressed={isChecked}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      {onEdit && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onEdit();
          }}
          className="absolute -top-2 left-2 inline-flex items-center justify-center rounded border border-gray-500 bg-gray-100 p-1 text-gray-500 shadow-sm transition hover:border-gray-300 hover:text-gray-700"
          aria-label={`Edit ${item.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Wear count badge */}
      {item.wearsSinceWash >= 1 && (
        <div className={`absolute -top-2 -right-2 ${badgeColor} text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg`}>
          {item.wearsSinceWash}
        </div>
      )}

      {/* Image or initials placeholder */}
      <div className="mb-3">
        {item.image ? (
          <ImageWithFallback
            src={item.image}
            alt={item.name}
            className="w-full h-32 object-cover rounded-lg"
          />
        ) : (
          <div 
            className={`w-full h-32 rounded-lg flex items-center justify-center text-white text-2xl ${getColorFromName(item.name)}`}
            style={{ backgroundColor: item.color || undefined }}
          >
            {getInitials(item.name)}
          </div>
        )}
      </div>

      {/* Clothes info */}
      <div className="space-y-1 mb-3">
        <h3 className="text-sm truncate">{item.name}</h3>
        <p className="text-xs text-gray-600">{item.type}</p>
        {item.color && (
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full border border-gray-300"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600 capitalize">{getColorName(item.color)}</span>
          </div>
        )}
        <p className={`text-xs ${wornToday ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
          {wearStatusLabel}
        </p>
      </div>

      {/* Wear today checkbox */}
      <div className="flex items-center space-x-2" data-no-card-toggle>
        <Checkbox
          id={`wear-${item.id}`}
          checked={isChecked}
          onCheckedChange={(value: boolean | 'indeterminate') => {
            if (value === 'indeterminate') {
              return;
            }
            onToggle(Boolean(value));
          }}
        />
        <label
          htmlFor={`wear-${item.id}`}
          className={`text-xs cursor-pointer ${wornToday ? 'text-red-600 font-medium' : 'text-gray-700'}`}
          data-no-card-toggle
        >
          {wornToday ? 'Undo worn today' : isChecked ? 'Remove from today' : 'Wear today'}
        </label>
      </div>
    </div>
  );
}