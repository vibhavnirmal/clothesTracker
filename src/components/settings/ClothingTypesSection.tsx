import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from '../ui/sonner';
import { createClothingType, deleteClothingType, updateClothingType } from '../../lib/api';
import type { ClothingType } from '../../types';
import { getIconDisplayName, getIconPath } from '../../lib/icons';
import { IconPickerModal } from '../IconPickerModal';

const NO_ICON_VALUE = '__no_icon__';

export interface ClothingTypesSectionProps {
  types: ClothingType[];
  onTypesUpdated: (types: ClothingType[]) => void;
  onBackToOverview: () => void;
  typeUsage: Record<string, number>;
}

export function ClothingTypesSection({
  types,
  onTypesUpdated,
  onBackToOverview,
  typeUsage,
}: ClothingTypesSectionProps) {
  const [newType, setNewType] = useState('');
  const [newIcon, setNewIcon] = useState<string>(NO_ICON_VALUE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingType, setDeletingType] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editIcon, setEditIcon] = useState<string>(NO_ICON_VALUE);
  const [showIconPicker, setShowIconPicker] = useState<'add' | 'edit' | null>(null);

  const sortedTypes = useMemo(() => [...types].sort((a, b) => a.name.localeCompare(b.name)), [types]);

  const handleDeleteType = async (typeName: string) => {
    const usageCount = typeUsage[typeName] ?? 0;
    if (usageCount > 0) {
      toast.error('This clothing type is still used by existing items. Remove or update them first.');
      return;
    }

    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Remove the clothing type “${typeName}”? This action cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setDeletingType(typeName);
    try {
      const { types: updated } = await deleteClothingType(typeName);
      onTypesUpdated(updated);
      toast.success(`Removed “${typeName}” from clothing types.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete clothing type';
      toast.error(message);
    } finally {
      setDeletingType(null);
    }
  };

  const handleAddType = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newType.trim();

    if (!trimmed) {
      toast.error('Enter a clothing type name to add it.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { types: updated } = await createClothingType(trimmed, newIcon === NO_ICON_VALUE ? null : newIcon);
      onTypesUpdated(updated);
      setNewType('');
      setNewIcon(NO_ICON_VALUE);
      toast.success(`Added "${trimmed}" to clothing types.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add clothing type';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (typeObj: ClothingType) => {
    setEditingType(typeObj.name);
    setEditValue(typeObj.name);
    setEditIcon(typeObj.icon || NO_ICON_VALUE);
  };

  const handleCancelEdit = () => {
    setEditingType(null);
    setEditValue('');
    setEditIcon(NO_ICON_VALUE);
  };

  const handleSaveEdit = async (oldName: string) => {
    const trimmed = editValue.trim();

    if (!trimmed) {
      toast.error('Type name cannot be empty.');
      return;
    }

    if (trimmed === oldName && editIcon === (types.find(t => t.name === oldName)?.icon || NO_ICON_VALUE)) {
      handleCancelEdit();
      return;
    }

    try {
      const { types: updated } = await updateClothingType(oldName, trimmed, editIcon === NO_ICON_VALUE ? null : editIcon);
      onTypesUpdated(updated);
      handleCancelEdit();
      toast.success(`Updated "${oldName}" to "${trimmed}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update clothing type';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 mb-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBackToOverview}
          aria-label="Back to settings overview"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Clothing types</h1>
          <p className="text-xs text-gray-500">Add, review, and maintain clothing types for your wardrobe.</p>
        </div>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm mb-4">
        <form onSubmit={handleAddType} className="space-y-3">
          <div className="space-y-1">
            <Label className="mb-2" htmlFor="new-type">
              Add clothing type
            </Label>
            <div className="relative">
              {newType && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewType('')}
                  aria-label="Clear clothing type input"
                  className="absolute right-0 top-0 z-50"
                  tabIndex={-1}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Input
                id="new-type"
                value={newType}
                placeholder="e.g., Rain Jacket"
                onChange={event => setNewType(event.target.value)}
                maxLength={40}
                className="pr-10"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="mb-2" htmlFor="new-icon">
              Icon (optional)
            </Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowIconPicker('add')}
            >
              {newIcon && newIcon !== NO_ICON_VALUE ? (
                <div className="flex items-center gap-2">
                  <img src={getIconPath(newIcon) || ''} alt="" className="w-4 h-4" />
                  <span>{getIconDisplayName(newIcon)}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">Select an icon</span>
              )}
            </Button>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || newType.trim().length === 0}
            className="flex items-center gap-2"
          >
            <ListPlus className="h-4 w-4" />
            Add type
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Existing types</h2>
        {sortedTypes.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No clothing types yet. Add one above to get started.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {sortedTypes.map(type => {
              const usageCount = typeUsage[type.name] ?? 0;
              const isDeleting = deletingType === type.name;
              const isEditing = editingType === type.name;

              return (
                <li
                  key={type.name}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 flex-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          maxLength={40}
                          className="h-8"
                          placeholder="Type name"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void handleSaveEdit(type.name);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          onClick={() => setShowIconPicker('edit')}
                        >
                          {editIcon && editIcon !== NO_ICON_VALUE ? (
                            <div className="flex items-center gap-2">
                              <img src={getIconPath(editIcon) || ''} alt="" className="w-4 h-4" />
                              <span>{getIconDisplayName(editIcon)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Select icon</span>
                          )}
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleSaveEdit(type.name)}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          {type.icon && (
                            <img src={getIconPath(type.icon) || ''} alt="" className="w-5 h-5" />
                          )}
                          <span className="truncate" title={type.name}>
                            {type.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {usageCount === 0 ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleDeleteType(type.name)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          ) : (
                            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">In use</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {usageCount > 0 && !isEditing && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      {usageCount === 1 ? '1 item uses this type' : `${usageCount} items use this type`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Icon Picker Modals */}
      <IconPickerModal
        isOpen={showIconPicker === 'add'}
        onClose={() => setShowIconPicker(null)}
        onSelect={(icon) => setNewIcon(icon || NO_ICON_VALUE)}
        currentIcon={newIcon !== NO_ICON_VALUE ? newIcon : null}
        clothingTypeName={newType.trim() || 'New Clothing Type'}
      />
      <IconPickerModal
        isOpen={showIconPicker === 'edit'}
        onClose={() => setShowIconPicker(null)}
        onSelect={(icon) => setEditIcon(icon || NO_ICON_VALUE)}
        currentIcon={editIcon !== NO_ICON_VALUE ? editIcon : null}
        clothingTypeName={editingType || undefined}
      />
    </div>
  );
}
