import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from '../ui/sonner';
import { createMaterialType, deleteMaterialType, updateMaterialType } from '../../lib/api';

export interface MaterialTypesSectionProps {
  materials: string[];
  onMaterialsUpdated: (materials: string[]) => void;
  onBackToOverview: () => void;
}

export function MaterialTypesSection({
  materials,
  onMaterialsUpdated,
  onBackToOverview,
}: MaterialTypesSectionProps) {
  const [newMaterial, setNewMaterial] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const sortedMaterials = useMemo(() => [...materials].sort((a, b) => a.localeCompare(b)), [materials]);

  const handleDeleteMaterial = async (materialName: string) => {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Remove the material type "${materialName}"? This action cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setDeletingMaterial(materialName);
    try {
      const { materials: updated } = await deleteMaterialType(materialName);
      onMaterialsUpdated(updated);
      toast.success(`Removed "${materialName}" from material types.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete material type';
      toast.error(message);
    } finally {
      setDeletingMaterial(null);
    }
  };

  const handleAddMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newMaterial.trim();

    if (!trimmed) {
      toast.error('Enter a material type name to add it.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { materials: updated } = await createMaterialType(trimmed);
      onMaterialsUpdated(updated);
      setNewMaterial('');
      toast.success(`Added "${trimmed}" to material types.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add material type';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (materialName: string) => {
    setEditingMaterial(materialName);
    setEditValue(materialName);
  };

  const handleCancelEdit = () => {
    setEditingMaterial(null);
    setEditValue('');
  };

  const handleSaveEdit = async (oldName: string) => {
    const trimmed = editValue.trim();

    if (!trimmed) {
      toast.error('Material name cannot be empty.');
      return;
    }

    if (trimmed === oldName) {
      handleCancelEdit();
      return;
    }

    try {
      const { materials: updated } = await updateMaterialType(oldName, trimmed);
      onMaterialsUpdated(updated);
      handleCancelEdit();
      toast.success(`Updated "${oldName}" to "${trimmed}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update material type';
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
          <h1 className="text-lg font-semibold text-gray-900">Material types</h1>
          <p className="text-xs text-gray-500">Add, review, and maintain material types for clothing composition.</p>
        </div>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm mb-4">
        <form onSubmit={handleAddMaterial} className="space-y-3">
          <div className="space-y-1">
            <Label className="mb-2" htmlFor="new-material">
              Add material type
            </Label>
            <div className="relative">
              {newMaterial && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewMaterial('')}
                  aria-label="Clear material type input"
                  className="absolute right-0 top-0 z-50"
                  tabIndex={-1}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Input
                id="new-material"
                value={newMaterial}
                placeholder="e.g., Bamboo, Cashmere"
                onChange={event => setNewMaterial(event.target.value)}
                maxLength={40}
                className="pr-10"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || newMaterial.trim().length === 0}
            className="flex items-center gap-2"
          >
            <ListPlus className="h-4 w-4" />
            Add material
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Existing materials</h2>
        {sortedMaterials.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No material types yet. Add one above to get started.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {sortedMaterials.map(material => {
              const isDeleting = deletingMaterial === material;
              const isEditing = editingMaterial === material;

              return (
                <li
                  key={material}
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
                              void handleSaveEdit(material);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleSaveEdit(material)}
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
                        <span className="truncate" title={material}>
                          {material}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(material)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDeleteMaterial(material)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
