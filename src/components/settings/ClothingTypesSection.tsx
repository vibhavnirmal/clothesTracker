import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from '../ui/sonner';
import { createClothingType, deleteClothingType, updateClothingType } from '../../lib/api';

export interface ClothingTypesSectionProps {
  types: string[];
  onTypesUpdated: (types: string[]) => void;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingType, setDeletingType] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const sortedTypes = useMemo(() => [...types].sort((a, b) => a.localeCompare(b)), [types]);

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
      const { types: updated } = await createClothingType(trimmed);
      onTypesUpdated(updated);
      setNewType('');
      toast.success(`Added "${trimmed}" to clothing types.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add clothing type';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (typeName: string) => {
    setEditingType(typeName);
    setEditValue(typeName);
  };

  const handleCancelEdit = () => {
    setEditingType(null);
    setEditValue('');
  };

  const handleSaveEdit = async (oldName: string) => {
    const trimmed = editValue.trim();

    if (!trimmed) {
      toast.error('Type name cannot be empty.');
      return;
    }

    if (trimmed === oldName) {
      handleCancelEdit();
      return;
    }

    try {
      const { types: updated } = await updateClothingType(oldName, trimmed);
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
              const usageCount = typeUsage[type] ?? 0;
              const isDeleting = deletingType === type;
              const isEditing = editingType === type;

              return (
                <li
                  key={type}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          maxLength={40}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void handleSaveEdit(type);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleSaveEdit(type)}
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
                    ) : (
                      <>
                        <span className="truncate" title={type}>
                          {type}
                        </span>
                        <div className="flex items-center gap-2">
                          {usageCount === 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(type)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {usageCount === 0 ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleDeleteType(type)}
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
    </div>
  );
}
