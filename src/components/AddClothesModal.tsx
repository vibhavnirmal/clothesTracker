import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { toast } from './ui/sonner';
import type { AddClothesPayload } from '../types';
import { COLOR_OPTIONS, getColorName } from '../lib/colors';
import { compressImage, estimateDataUrlBytes } from '../lib/imageCompression';

interface AddClothesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clothes: AddClothesPayload) => Promise<void> | void;
  title?: string;
  submitLabel?: string;
  initialValues?: Partial<AddClothesPayload>;
}

const clothingTypes = [
  'Shirt', 'T-Shirt', 'Pants', 'Jeans', 'Shorts',
  'Sweater', 'Hoodie', 'Jacket', 'Blazer', 'Underwear', 'Socks',
  'Handkerchief', 'Shoes', 'Boots', 'Sandals', 'Slippers', 'Towel'
];

function buildInitialForm(values?: Partial<AddClothesPayload>): AddClothesPayload {
  return {
    name: values?.name ?? '',
    type: values?.type ?? '',
    color: values?.color ?? '',
    image: values?.image ?? '',
  };
}

export function AddClothesModal({
  isOpen,
  onClose,
  onSubmit,
  title = 'Add New Clothes',
  submitLabel = 'Add Clothes',
  initialValues,
}: AddClothesModalProps) {
  const [formData, setFormData] = useState<AddClothesPayload>(() => buildInitialForm(initialValues));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ size: number; quality: number; resized: boolean } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const processingImageRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      const initialForm = buildInitialForm(initialValues);
      setFormData(initialForm);
      if (initialForm.image) {
        setImageMeta({
          size: estimateDataUrlBytes(initialForm.image),
          quality: 1,
          resized: false,
        });
      } else {
        setImageMeta(null);
      }
      setImageError(null);
      setIsProcessingImage(false);
      setImageChanged(false);
      processingImageRef.current = false;
    }
  }, [isOpen, initialValues]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name || !formData.type || isSubmitting || isProcessingImage || processingImageRef.current) {
      return;
    }

    const payload: AddClothesPayload = {
      name: formData.name,
      type: formData.type,
      color: formData.color,
    };

    if (imageChanged) {
      payload.image = formData.image ?? '';
    }

    try {
      setIsSubmitting(true);
      await onSubmit(payload);
      toast.success('Clothing saved successfully');
      setFormData(buildInitialForm());
      setImageMeta(null);
      setImageError(null);
      setImageChanged(false);
      onClose();
    } catch (err) {
      console.error('Failed to save clothes', err);
      toast.error('Failed to save clothes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      setFormData((prev: AddClothesPayload) => ({ ...prev, image: '' }));
      setImageMeta(null);
      setImageError(null);
      setImageChanged(true);
      return;
    }

    const previousImage = formData.image;
    const previousMeta = imageMeta;
    const previousImageChanged = imageChanged;

    processingImageRef.current = true;
    setIsProcessingImage(true);
    setImageError(null);

    try {
      const compressed = await compressImage(file, {
        targetKilobytes: 50,
        minQuality: 0.55,
      });

      setFormData((prev: AddClothesPayload) => ({ ...prev, image: compressed.dataUrl }));
      setImageMeta({
        size: compressed.bytes,
        quality: compressed.quality,
        resized: compressed.wasResized,
      });
      setImageChanged(true);
    } catch (error) {
      console.error('Failed to process image', error);
      setFormData((prev: AddClothesPayload) => ({ ...prev, image: previousImage ?? '' }));
      if (previousImage) {
        setImageMeta(previousMeta ?? {
          size: estimateDataUrlBytes(previousImage),
          quality: 1,
          resized: false,
        });
      } else {
        setImageMeta(null);
      }
      setImageError('Unable to process this image. Please try a different one.');
      toast.error('Unable to process this image. Please try a different one.');
      setImageChanged(previousImageChanged);
    } finally {
      setIsProcessingImage(false);
      processingImageRef.current = false;
      e.target.value = '';
    }
  };

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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setFormData((prev: AddClothesPayload) => ({ ...prev, name: event.target.value }))
              }
              placeholder="e.g., Blue Denim Shirt"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: string) =>
                setFormData((prev: AddClothesPayload) => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select clothing type" />
              </SelectTrigger>
              <SelectContent>
                {clothingTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <ToggleGroup
              type="single"
              value={formData.color || ''}
              onValueChange={(value: string) =>
                setFormData((prev: AddClothesPayload) => ({ ...prev, color: value || '' }))
              }
              aria-label="Select clothing color"
              className="grid grid-cols-6 gap-2"
            >
              {COLOR_OPTIONS.map(color => (
                <ToggleGroupItem
                  key={color.name}
                  value={color.value}
                  className={`h-9 w-9 rounded-full border-2 border-transparent transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 data-[state=on]:border-black data-[state=on]:scale-110`}
                  style={{ backgroundColor: color.value }}
                  aria-label={color.name}
                >
                  <span className="sr-only">{color.name}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {formData.color && (
              <div className="flex items-center gap-2 mt-2">
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: formData.color }}
                />
                <span className="text-sm text-gray-600">{getColorName(formData.color)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image (Optional)</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {(isProcessingImage || imageError || formData.image) && (
              <div className="mt-2 space-y-2">
                {isProcessingImage && (
                  <p className="text-sm text-muted-foreground">Compressing image…</p>
                )}
                {imageError && <p className="text-sm text-red-500">{imageError}</p>}
                {formData.image && !isProcessingImage && (
                  <div className="flex items-center gap-3">
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded-lg border"
                    />
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>
                        Approx. {Math.max(1, Math.round((imageMeta?.size ?? estimateDataUrlBytes(formData.image)) / 1024))} KB
                        {imageMeta?.resized ? ' · resized' : ''}
                      </p>
                      <p>Quality ~{Math.round((imageMeta?.quality ?? 1) * 100)}%</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!formData.name || !formData.type || isSubmitting || isProcessingImage}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}