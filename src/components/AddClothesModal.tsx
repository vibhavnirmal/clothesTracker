import { X } from 'lucide-react';
import type { AddClothesPayload } from '../types';
import { Button } from './ui/button';
import { ClothingForm } from './ClothingForm';

interface AddClothesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clothes: AddClothesPayload) => Promise<void> | void;
  title?: string;
  submitLabel?: string;
  initialValues?: Partial<AddClothesPayload>;
  typeOptions: string[];
  onManageTypes?: () => void;
}

export function AddClothesModal({
  isOpen,
  onClose,
  onSubmit,
  title = 'Add New Clothing',
  submitLabel = 'Add Clothing',
  initialValues,
  typeOptions,
  onManageTypes,
}: AddClothesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-6">
          <ClothingForm
            initialValues={initialValues}
            typeOptions={typeOptions}
            onSubmit={onSubmit}
            submitLabel={submitLabel}
            onCancel={onClose}
            onManageTypes={onManageTypes}
            onSubmitSuccess={onClose}
          />
        </div>
      </div>
    </div>
  );
}