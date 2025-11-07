import React from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from './ui/sonner';
import { ImageWithFallback } from './ImageWithFallback';
import type { ClothesItem, ClothingType } from '../types';
import { differenceInCalendarDays, parseIsoDateToLocal, startOfToday } from '../lib/date';
import { getIconPath } from '../lib/icons';

interface WashClothesProps {
  clothes: ClothesItem[];
  clothingTypes: ClothingType[];
  onRemoveFromBag: (clothesId: string) => Promise<void> | void;
  onWashAll: () => Promise<void> | void;
}

export function WashClothes({ clothes, clothingTypes, onRemoveFromBag, onWashAll }: WashClothesProps) {
  const laundryBagItems = clothes.filter(item => item.inLaundryBag);

  const handleRemove = async (clothesId: string) => {
    try {
      await onRemoveFromBag(clothesId);
      toast.success('Removed from laundry bag');
    } catch (error) {
      toast.error('Failed to remove from laundry bag');
      console.error('Error removing from laundry bag:', error);
    }
  };

  const handleWashAll = async () => {
    if (laundryBagItems.length === 0) {
      toast.error('Laundry bag is empty');
      return;
    }

    try {
      await onWashAll();
      toast.success(`Washed ${laundryBagItems.length} items!`);
    } catch (error) {
      toast.error('Failed to wash items');
      console.error('Error washing items:', error);
    }
  };

  const getDaysSinceLastWash = (item: ClothesItem) => {
    if (!item.lastWashDate) return null;
    const lastWashed = parseIsoDateToLocal(item.lastWashDate);
    if (!lastWashed) return null;
    const today = startOfToday();
    return differenceInCalendarDays(today, lastWashed);
  };

  if (laundryBagItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center" style={{ padding: "15px", margin: "15px"}}>
        <ShoppingBag className="h-24 w-24 text-gray-300 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Laundry Bag is Empty</h2>
        <p className="text-gray-500">Add items from the home page to start building your laundry load</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" style={{ paddingBottom: '8rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          <h2 className="text-xl font-semibold">Laundry Bag</h2>
        </div>
        <Button 
          onClick={handleWashAll}
          disabled={laundryBagItems.length === 0}
          variant="outline"
        >
          Wash All ({laundryBagItems.length})
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {laundryBagItems.map(item => {
          const daysSinceWash = getDaysSinceLastWash(item);
          const typeInfo = clothingTypes.find(t => t.name === item.type);
          
          return (
            <div
              key={item.id}
              className="relative bg-white hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => handleRemove(item.id)}
                className="absolute top-2 right-2 p-1.5 bg-red-100 hover:bg-red-200 rounded-full transition-colors z-10"
                title="Remove from laundry bag"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>

              <div className="w-full h-48 mb-3 bg-gray-100 overflow-hidden">
                {item.image ? (
                  <ImageWithFallback
                    src={item.image}
                    alt={item.name}
                    style={{ height: "200px", width: "100%"}}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200" 
                      style={{ height: "200px", width: "100%"}}>
                    <ShoppingBag className="h-16 w-16 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {typeInfo?.icon && (
                    <img src={getIconPath(typeInfo.icon) || ''} alt="" className="w-5 h-5 flex-shrink-0" />
                  )}
                  <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                
                {item.color && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                )}
                </div>
                {daysSinceWash !== null && (
                  <p className="text-xs text-gray-500">
                    Last washed: {daysSinceWash} {daysSinceWash === 1 ? 'day' : 'days'} ago
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
