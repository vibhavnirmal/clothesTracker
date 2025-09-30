import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { toast } from './ui/sonner';
import type { AddClothesPayload } from '../types';
import { COLOR_OPTIONS, getColorName } from '../lib/colors';
import { compressImage, estimateDataUrlBytes } from '../lib/imageCompression';
import { buildInitialClothingForm } from '../lib/buildInitialClothingForm';
import { ApiError } from '../lib/api';
import { formatDateAsLocalIso } from '../lib/date';

interface ClothingFormProps {
    initialValues?: Partial<AddClothesPayload>;
    typeOptions: string[];
    onSubmit: (payload: AddClothesPayload) => Promise<void> | void;
    submitLabel?: string;
    onCancel?: () => void;
    cancelLabel?: string;
    onManageTypes?: () => void;
    successMessage?: string;
    onSubmitSuccess?: () => void;
}

export function ClothingForm({
    initialValues,
    typeOptions,
    onSubmit,
    submitLabel = 'Save',
    onCancel,
    cancelLabel = 'Cancel',
    onManageTypes,
    successMessage = 'Clothing saved successfully',
    onSubmitSuccess,
}: ClothingFormProps) {
    const [formData, setFormData] = useState<AddClothesPayload>(() => buildInitialClothingForm(initialValues));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [imageMeta, setImageMeta] = useState<{ size: number; quality: number; resized: boolean } | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [imageChanged, setImageChanged] = useState(false);
    const [serverErrors, setServerErrors] = useState<string[]>([]);
    const processingImageRef = useRef(false);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const todayLocalIso = useMemo(() => formatDateAsLocalIso(new Date()), []);
    const openFilePicker = (capture?: 'environment' | 'user') => {
        const input = imageInputRef.current;
        if (!input) return;

        if (capture) {
            input.setAttribute('capture', capture);
        } else {
            input.removeAttribute('capture');
        }

        input.click();
    };

    const availableTypeOptions = useMemo(() => {
        const unique = new Set<string>();
        typeOptions.forEach(type => {
            if (typeof type === 'string' && type.trim().length > 0) {
                unique.add(type.trim());
            }
        });
        if (formData.type && formData.type.trim().length > 0) {
            unique.add(formData.type.trim());
        }
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [typeOptions, formData.type]);

    useEffect(() => {
        const nextForm = buildInitialClothingForm(initialValues);
        setFormData(nextForm);
        if (nextForm.image) {
            setImageMeta({
                size: estimateDataUrlBytes(nextForm.image),
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
        setServerErrors([]);
    }, [initialValues]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formData.name || !formData.type || isSubmitting || isProcessingImage || processingImageRef.current) {
            return;
        }

        const payload: AddClothesPayload = {
            name: formData.name,
            type: formData.type,
            color: formData.color,
            dateOfPurchase: formData.dateOfPurchase,
            purchasePrice: formData.purchasePrice,
            brand: formData.brand,
            size: formData.size,
            material: formData.material,
            season: formData.season,
            careInstructions: formData.careInstructions,
            notes: formData.notes,
        };

        if (imageChanged) {
            payload.image = formData.image ?? '';
        }

        try {
            setIsSubmitting(true);
            await onSubmit(payload);
            toast.success(successMessage);
            setFormData(buildInitialClothingForm(initialValues));
            setImageMeta(null);
            setImageError(null);
            setImageChanged(false);
            setServerErrors([]);
            onSubmitSuccess?.();
        } catch (error) {
            console.error('Failed to save clothes', error);

            if (error instanceof ApiError) {
                const details = error.details as { errors?: unknown } | null;
                const extractedErrors = Array.isArray(details?.errors)
                    ? (details?.errors as unknown[])
                        .map(err => (typeof err === 'string' && err.trim().length > 0 ? err.trim() : null))
                        .filter((err): err is string => Boolean(err))
                    : [];

                if (extractedErrors.length > 0) {
                    setServerErrors(extractedErrors);
                } else {
                    setServerErrors([error.message || 'Failed to save clothes. Please try again.']);
                }

                toast.error(error.message || 'Failed to save clothes. Please try again.');
            } else {
                setServerErrors(['Failed to save clothes. Please try again.']);
                toast.error('Failed to save clothes. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            setFormData(prev => ({ ...prev, image: '' }));
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

            setFormData(prev => ({ ...prev, image: compressed.dataUrl }));
            setImageMeta({
                size: compressed.bytes,
                quality: compressed.quality,
                resized: compressed.wasResized,
            });
            setImageChanged(true);
        } catch (error) {
            console.error('Failed to process image', error);
            setFormData(prev => ({ ...prev, image: previousImage ?? '' }));
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
            event.target.value = '';
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {serverErrors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p className="font-medium">We couldn&apos;t save this clothing item:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        {serverErrors.map((error, index) => (
                            <li key={`${error}-${index}`}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFormData(prev => ({ ...prev, name: event.target.value }))
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
                        setFormData(prev => ({ ...prev, type: value }))
                    }
                    disabled={availableTypeOptions.length === 0}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select clothing type" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableTypeOptions.length === 0 ? (
                            <SelectItem value="no-types" disabled>
                                No types yet
                            </SelectItem>
                        ) : (
                            availableTypeOptions.map(type => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>


            <div className="space-y-2">
                <Label htmlFor="date-of-purchase">Date of Purchase</Label>
                <Input
                    id="date-of-purchase"
                    type="date"
                    value={formData.dateOfPurchase || ''}
                    max={todayLocalIso}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFormData(prev => ({
                            ...prev,
                            dateOfPurchase: event.target.value,
                        }))
                    }
                />
            </div>

            {/* New optional fields */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                        id="brand"
                        value={formData.brand || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, brand: event.target.value }))
                        }
                        placeholder="e.g., Nike, Zara"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="size">Size</Label>
                    <Input
                        id="size"
                        value={formData.size || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, size: event.target.value }))
                        }
                        placeholder="e.g., M, L, 32"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="purchase-price">Purchase Price</Label>
                    <Input
                        id="purchase-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.purchasePrice || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ 
                                ...prev, 
                                purchasePrice: event.target.value ? parseFloat(event.target.value) : undefined 
                            }))
                        }
                        placeholder="0.00"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="season">Season</Label>
                    <Select
                        value={formData.season ?? '__any'}
                        onValueChange={(value: string) =>
                            setFormData(prev => ({
                                ...prev,
                                season: value === '__any'
                                    ? undefined
                                    : (value as 'spring' | 'summer' | 'fall' | 'winter' | 'all'),
                            }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select season" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__any">Any season</SelectItem>
                            <SelectItem value="spring">Spring</SelectItem>
                            <SelectItem value="summer">Summer</SelectItem>
                            <SelectItem value="fall">Fall</SelectItem>
                            <SelectItem value="winter">Winter</SelectItem>
                            <SelectItem value="all">All seasons</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="material">Material</Label>
                <Input
                    id="material"
                    value={formData.material || ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFormData(prev => ({ ...prev, material: event.target.value }))
                    }
                    placeholder="e.g., Cotton, Polyester, Wool"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="image-upload-control">Image (Optional)</Label>
                <div className="flex flex-wrap items-center gap-2" id="image-upload-control">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => openFilePicker('environment')}
                        disabled={isProcessingImage}
                    >
                        Take photo
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => openFilePicker()}
                        disabled={isProcessingImage}
                    >
                        Choose from gallery
                    </Button>
                    {formData.image && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setFormData(prev => ({ ...prev, image: '' }));
                                setImageMeta(null);
                                setImageError(null);
                                setImageChanged(true);
                            }}
                        >
                            Remove image
                        </Button>
                    )}
                </div>
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
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

            <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <ToggleGroup
                    type="single"
                    value={formData.color || ''}
                    onValueChange={(value: string) =>
                        setFormData(prev => ({ ...prev, color: value || '' }))
                    }
                    aria-label="Select clothing color"
                    className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(6rem, 1fr))' }}
                >
                    {COLOR_OPTIONS.map(color => {
                        const hex = color.value?.replace('#', '') ?? '';
                        let textColor = '#0f172a';

                        if (/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex)) {
                            const expanded = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
                            const r = parseInt(expanded.slice(0, 2), 16);
                            const g = parseInt(expanded.slice(2, 4), 16);
                            const b = parseInt(expanded.slice(4, 6), 16);
                            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                            textColor = luminance > 0.58 ? '#0f172a' : '#ffffff';
                        }

                        const isSelected = formData.color === color.value;
                        const itemOpacity = formData.color ? (isSelected ? 1 : 0.35) : 1;

                        return (
                            <ToggleGroupItem
                                key={color.name}
                                value={color.value}
                                className="flex h-8 w-24 items-center justify-center rounded-full border-2 border-transparent text-xs font-medium uppercase tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 data-[state=on]:scale-95 data-[state=on]:border-black data-[state=on]:shadow-lg"
                                style={{
                                    backgroundColor: color.value,
                                    color: textColor,
                                    opacity: itemOpacity,
                                    boxShadow: isSelected ? '0 0 0 3px rgba(15, 23, 42, 0.25)' : undefined,
                                }}
                                aria-label={color.name}
                                title={color.name}
                            >
                                {color.name}
                            </ToggleGroupItem>
                        );
                    })}
                </ToggleGroup>
                <div className="flex items-center gap-2 mt-2 text-center justify-center border-t" style={{ paddingTop: '0.75rem' }}>
                    <span className="text-sm font-medium">Selected color:</span>
                    {formData.color && (
                        <div
                            className="w-12 h-8 rounded-md border border-gray-300"
                            style={{ backgroundColor: formData.color }}
                        />
                    )}
                    <span className="text-sm text-gray-600">
                        {formData.color ? getColorName(formData.color) : 'No color selected'}
                    </span>
                </div>
            </div>


            <div className="flex gap-3 pt-4">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                        {cancelLabel}
                    </Button>
                )}
                <Button
                    type="submit"
                    className={onCancel ? 'flex-1' : 'w-full'}
                    disabled={!formData.name || !formData.type || isSubmitting || isProcessingImage}
                >
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
