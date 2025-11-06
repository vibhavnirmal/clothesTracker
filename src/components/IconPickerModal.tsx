import { useState, useMemo, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AVAILABLE_ICONS, getIconDisplayName, getIconPath, searchIcons } from '../lib/icons';

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconName: string | null) => void;
  currentIcon?: string | null;
  clothingTypeName?: string;
}

export function IconPickerModal({ isOpen, onClose, onSelect, currentIcon, clothingTypeName }: IconPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredIcons = useMemo(() => searchIcons(searchQuery), [searchQuery]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSelect = (iconName: string | null) => {
    onSelect(iconName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white shadow-xl max-w-md w-full mx-4 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Select Icon</h2>
            {clothingTypeName && (
              <p className="text-sm text-gray-600">for "{clothingTypeName}"</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search icons..."
              className="pl-9"
            />
          </div>

          {/* None option */}
          <div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSelect(null)}
            >
              <span className="text-sm">No icon</span>
            </Button>
          </div>

          {/* Icons grid */}
          <div className="grid grid-cols-2 gap-2">
            {filteredIcons.map((icon) => (
              <button
                key={icon}
                onClick={() => handleSelect(icon)}
                className={`
                  flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                  hover:border-blue-500 hover:bg-blue-50
                  ${currentIcon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                `}
                title={getIconDisplayName(icon)}
              >
                <img 
                  src={getIconPath(icon) || ''} 
                  alt={getIconDisplayName(icon)} 
                  className="w-12 h-12 mb-2"
                />
                <span className="text-xs text-gray-600 text-center line-clamp-2">
                  {getIconDisplayName(icon)}
                </span>
              </button>
            ))}
          </div>
          
          {filteredIcons.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No icons found matching "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
