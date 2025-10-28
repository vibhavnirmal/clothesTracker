import React from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import type { AddClothesPayload } from '../types';
import { ClothingForm } from './ClothingForm';
import { Button } from './ui/button';

interface AddClothesPageProps {
  typeOptions: string[];
  materialOptions: string[];
  onSubmit: (payload: AddClothesPayload) => Promise<void> | void;
  onCancel: () => void;
  onManageTypes?: () => void;
  onSubmitSuccess?: () => void;
}

export function AddClothesPage({
  typeOptions,
  materialOptions,
  onSubmit,
  onCancel,
  onManageTypes,
  onSubmitSuccess,
}: AddClothesPageProps) {
  return (
    <div className="" style={{ paddingBottom: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="p-4 space-y-6">
        <header className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Back to home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                {/* <Plus className="h-5 w-5 text-blue-500" /> */}
                Add clothing
              </h1>
              {/* <p className="text-xs text-gray-500">Track a new wardrobe item with color, type, and purchase details.</p> */}
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5">
          <ClothingForm
            typeOptions={typeOptions}
            materialOptions={materialOptions}
            onSubmit={onSubmit}
            submitLabel="Add clothing"
            onCancel={onCancel}
            cancelLabel="Back"
            onManageTypes={onManageTypes}
            onSubmitSuccess={onSubmitSuccess}
            successMessage="Clothing added successfully"
          />
        </section>
      </div>
    </div>
  );
}

export default AddClothesPage;
