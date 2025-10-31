import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Checkbox } from './ui/checkbox';
import { X, Search, Minus as MinusIcon, Plus as PlusIcon } from 'lucide-react';
import { toast } from './ui/sonner';
import type { AddClothesPayload } from '../types';
import { COLOR_OPTIONS, getColorName } from '../lib/colors';
import { compressImage, estimateDataUrlBytes } from '../lib/imageCompression';
import { buildInitialClothingForm } from '../lib/buildInitialClothingForm';

// Size and material options for clothing items
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size', 'Custom'];

// Common manufacturing locations
const DEFAULT_MADE_IN_LOCATIONS = [
    'Bangladesh',
    'China',
    'India',
    'Vietnam',
    'Turkey',
    'Indonesia',
    'Pakistan',
    'Thailand',
    'Cambodia',
    'Sri Lanka',
    'USA',
    'Mexico',
    'Italy',
    'Portugal',
    'Romania'
];

const clampPercentage = (value: number) => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
};

const calculateEvenDistribution = (materials: string[]): Record<string, number> => {
    if (materials.length === 0) {
        return {};
    }

    const base = Math.floor(100 / materials.length);
    const remainder = 100 - base * (materials.length - 1);
    return materials.reduce<Record<string, number>>((acc, material, index) => {
        acc[material] = index === materials.length - 1 ? remainder : base;
        return acc;
    }, {});
};

interface ClothingFormProps {
    initialValues?: Partial<AddClothesPayload>;
    typeOptions: string[];
    materialOptions: string[];
    madeInOptions?: string[];
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
    materialOptions,
    madeInOptions = [],
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
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>(() => 
        formData.materials ? Object.keys(formData.materials) : []
    );
    const [materialPercentages, setMaterialPercentages] = useState<Record<string, number>>(() => 
        formData.materials || {}
    );
    const [editedMaterials, setEditedMaterials] = useState<Set<string>>(() => new Set());
    const [showMadeInModal, setShowMadeInModal] = useState(false);
    const [madeInSearch, setMadeInSearch] = useState('');
    const processingImageRef = useRef(false);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);

    const totalMaterialPercentage = useMemo(() =>
        selectedMaterials.reduce((acc, material) => acc + (materialPercentages[material] ?? 0), 0),
        [selectedMaterials, materialPercentages]
    );

    const remainingMaterialPercentage = 100 - totalMaterialPercentage;
    const hasMaterialTotalError = Math.abs(remainingMaterialPercentage) > 0.01;

    useEffect(() => {
        setEditedMaterials(prev => {
            const filtered = new Set<string>();
            selectedMaterials.forEach(material => {
                if (prev.has(material)) {
                    filtered.add(material);
                }
            });
            if (filtered.size === prev.size) {
                return prev;
            }
            return filtered;
        });
    }, [selectedMaterials]);

    const handleMaterialPercentageChange = useCallback((material: string, nextValue: number, options?: { markEdited?: boolean }) => {
        const markEdited = options?.markEdited ?? true;

        setMaterialPercentages(prev => {
            const next = { ...prev };
            const updatedEdited = new Set(editedMaterials);
            if (markEdited) {
                updatedEdited.add(material);
            }

            const clampedValue = clampPercentage(nextValue);
            next[material] = clampedValue;

            const untouchedMaterials = selectedMaterials.filter(mat => !updatedEdited.has(mat) && mat !== material);
            const autoMaterial = untouchedMaterials.length > 0
                ? untouchedMaterials[untouchedMaterials.length - 1]
                : null;

            if (autoMaterial) {
                const totalExcluding = selectedMaterials.reduce((acc, mat) => {
                    if (mat === autoMaterial) {
                        return acc;
                    }
                    return acc + (mat === material ? clampedValue : next[mat] ?? 0);
                }, 0);
                next[autoMaterial] = clampPercentage(100 - totalExcluding);
            }

            const sanitized: Record<string, number> = {};
            selectedMaterials.forEach(mat => {
                sanitized[mat] = next[mat] ?? 0;
            });

            setEditedMaterials(new Set(updatedEdited));
            setFormData(prevForm => ({
                ...prevForm,
                materials: Object.keys(sanitized).length > 0 ? sanitized : undefined,
            }));

            return sanitized;
        });
    }, [editedMaterials, selectedMaterials, setFormData]);

    const handleMaterialStep = useCallback((material: string, delta: number) => {
        const current = materialPercentages[material] ?? 0;
        handleMaterialPercentageChange(material, current + delta);
    }, [materialPercentages, handleMaterialPercentageChange]);

    const distributeEvenly = useCallback(() => {
        if (selectedMaterials.length === 0) {
            return;
        }

        const even = calculateEvenDistribution(selectedMaterials);
        setMaterialPercentages(even);
        setEditedMaterials(new Set());
        setFormData(prevForm => ({
            ...prevForm,
            materials: even,
        }));
    }, [selectedMaterials, setFormData]);

    const handleBalanceRemaining = useCallback(() => {
        if (selectedMaterials.length === 0) {
            return;
        }

        setMaterialPercentages(prev => {
            const manualSet = new Set(editedMaterials);
            const untouchedMaterials = selectedMaterials.filter(material => !manualSet.has(material));
            let autoMaterial: string | null = untouchedMaterials.length > 0
                ? untouchedMaterials[untouchedMaterials.length - 1]
                : null;

            if (!autoMaterial) {
                autoMaterial = selectedMaterials[selectedMaterials.length - 1];
            }

            if (!autoMaterial) {
                return prev;
            }

            const next = { ...prev };
            const totalExcluding = selectedMaterials.reduce((acc, material) => {
                if (material === autoMaterial) {
                    return acc;
                }
                return acc + (next[material] ?? 0);
            }, 0);
            next[autoMaterial] = clampPercentage(100 - totalExcluding);

            const sanitized: Record<string, number> = {};
            selectedMaterials.forEach(material => {
                sanitized[material] = next[material] ?? 0;
            });

            manualSet.delete(autoMaterial);
            setEditedMaterials(new Set(manualSet));
            setFormData(prevForm => ({
                ...prevForm,
                materials: sanitized,
            }));

            return sanitized;
        });
    }, [editedMaterials, selectedMaterials, setFormData]);

    // Merge default locations with user's existing locations
    const allMadeInOptions = useMemo(() => {
        const combined = new Set([...DEFAULT_MADE_IN_LOCATIONS, ...(madeInOptions || [])]);
        return Array.from(combined).sort();
    }, [madeInOptions]);

    const filteredMadeInOptions = useMemo(() => {
        if (!madeInSearch.trim()) return allMadeInOptions;
        const search = madeInSearch.toLowerCase();
        return allMadeInOptions.filter(location => location.toLowerCase().includes(search));
    }, [allMadeInOptions, madeInSearch]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (showMadeInModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showMadeInModal]);

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
        // Preserve the order from typeOptions (already sorted by usage on backend)
        // Only add unique types in the order they appear in typeOptions
        const orderedTypes: string[] = [];
        typeOptions.forEach(type => {
            if (typeof type === 'string' && type.trim().length > 0 && unique.has(type.trim())) {
                orderedTypes.push(type.trim());
                unique.delete(type.trim());
            }
        });
        // Add formData.type at the end if it wasn't in typeOptions
        if (formData.type && formData.type.trim().length > 0 && unique.has(formData.type.trim())) {
            orderedTypes.push(formData.type.trim());
        }
        return orderedTypes;
    }, [typeOptions, formData.type]);

    useEffect(() => {
        const nextForm = buildInitialClothingForm(initialValues);
        setFormData(nextForm);
        setSelectedMaterials(nextForm.materials ? Object.keys(nextForm.materials) : []);
        setMaterialPercentages(nextForm.materials || {});
        setEditedMaterials(new Set());
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
    }, [initialValues]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formData.name || !formData.type || isSubmitting || isProcessingImage || processingImageRef.current) {
            return;
        }

        // Validate materials sum to 100% if any are selected
        if (selectedMaterials.length > 0) {
            const sum = selectedMaterials.reduce((acc, mat) => acc + (materialPercentages[mat] || 0), 0);
            if (Math.abs(sum - 100) > 0.01) {
                toast.error(`Material percentages must sum to 100%. Current total: ${sum.toFixed(1)}%`);
                return;
            }
        }

        const payload: AddClothesPayload = {
            name: formData.name,
            type: formData.type,
            color: formData.color,
            dateOfPurchase: formData.dateOfPurchase,
        };

        if (formData.size) {
            payload.size = formData.size;
        }

        if (selectedMaterials.length > 0) {
            payload.materials = { ...materialPercentages };
        }

        if (imageChanged) {
            payload.image = formData.image ?? '';
        }

        try {
            setIsSubmitting(true);
            await onSubmit(payload);
            toast.success(successMessage);
            setFormData(buildInitialClothingForm(initialValues));
            setSelectedMaterials([]);
            setMaterialPercentages({});
            setImageMeta(null);
            setImageError(null);
            setImageChanged(false);
            onSubmitSuccess?.();
        } catch (error) {
            console.error('Failed to save clothes', error);
            toast.error('Failed to save clothes. Please try again.');
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
                            <SelectItem value="" disabled>
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
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFormData(prev => ({
                            ...prev,
                            dateOfPurchase: event.target.value,
                        }))
                    }
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="size">Size</Label>
                <Select
                    value={formData.size || 'none'}
                    onValueChange={(value: string) =>
                        setFormData(prev => ({ ...prev, size: value === 'none' ? undefined : value }))
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select size (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No size</SelectItem>
                        {SIZE_OPTIONS.map(size => (
                            <SelectItem key={size} value={size}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="made-in">Made In</Label>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowMadeInModal(true)}
                    className="w-full justify-start text-left font-normal"
                >
                    {formData.madeIn || 'Select location...'}
                </Button>
            </div>

            <div className="space-y-3">
                <Label>Material Composition</Label>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {materialOptions.map((material: string) => {
                            const isSelected = selectedMaterials.includes(material);
                            return (
                                <div key={material} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`material-${material}`}
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                const newMaterials = [...selectedMaterials, material];
                                                const evenPercentages = calculateEvenDistribution(newMaterials);
                                                setSelectedMaterials(newMaterials);
                                                setMaterialPercentages(evenPercentages);
                                                setEditedMaterials(new Set());
                                                setFormData(prev => ({ ...prev, materials: evenPercentages }));
                                            } else {
                                                const newMaterials = selectedMaterials.filter(m => m !== material);
                                                setSelectedMaterials(newMaterials);
                                                const newPercentages = newMaterials.length > 0
                                                    ? calculateEvenDistribution(newMaterials)
                                                    : {};
                                                setMaterialPercentages(newPercentages);
                                                setEditedMaterials(prevEdited => {
                                                    const nextEdited = new Set<string>();
                                                    newMaterials.forEach(mat => {
                                                        if (prevEdited.has(mat)) {
                                                            nextEdited.add(mat);
                                                        }
                                                    });
                                                    return nextEdited;
                                                });
                                                setFormData(prev => ({ 
                                                    ...prev, 
                                                    materials: newMaterials.length > 0 ? newPercentages : undefined 
                                                }));
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor={`material-${material}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        {material}
                                    </label>
                                </div>
                            );
                        })}
                    </div>

                    {selectedMaterials.length > 0 && (
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex flex-wrap items-center justify-between gap-2" style={{ paddingTop: "10px"}}>
                                <p className={`text-sm ${hasMaterialTotalError ? 'text-red-600' : 'text-muted-foreground'}`}>
                                    Total: {totalMaterialPercentage.toFixed(1)}% {hasMaterialTotalError && `• ${remainingMaterialPercentage > 0 ? `${remainingMaterialPercentage.toFixed(1)}% unassigned` : `${Math.abs(remainingMaterialPercentage).toFixed(1)}% over`}`}
                                </p>
                                {selectedMaterials.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={distributeEvenly}
                                        className="h-7 px-2"
                                    >
                                        Distribute evenly
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {selectedMaterials.map(material => {
                                    const value = materialPercentages[material] ?? 0;
                                    return (
                                        <div key={material} className="flex items-center justify-between gap-3 rounded-md border border-gray-200/80 px-2 py-2">
                                            <span className="text-sm font-medium">{material}</span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleMaterialStep(material, -1)}
                                                    aria-label={`Decrease ${material}`}
                                                >
                                                    <MinusIcon className="h-4 w-4" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    value={value}
                                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                        handleMaterialPercentageChange(material, Number(event.target.value))
                                                    }
                                                    className="w-20 text-right"
                                                    inputMode="numeric"
                                                />
                                                <span className="text-sm text-muted-foreground">%</span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleMaterialStep(material, 1)}
                                                    aria-label={`Increase ${material}`}
                                                >
                                                    <PlusIcon className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {hasMaterialTotalError && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm text-red-600">
                                        ⚠️ Total must equal 100%
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBalanceRemaining}
                                        className="w-fit"
                                    >
                                        Balance remaining automatically
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="image-upload-control">Image (Optional)</Label>
                <div className="flex flex-wrap items-center gap-2" id="image-upload-control">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isProcessingImage}
                    >
                        Take Photo
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isProcessingImage}
                    >
                        Choose from Files
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
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                />
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
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

            {/* Made In Location Modal */}
            {showMadeInModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                    onClick={() => setShowMadeInModal(false)}
                >
                    <div 
                        className="bg-white rounded-lg w-full max-w-md flex flex-col"
                        style={{ margin: '1rem', maxHeight: '93vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold">Select Manufacturing Location</h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowMadeInModal(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute right-2 top-2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Search or type custom location..."
                                    value={madeInSearch}
                                    onChange={(e) => setMadeInSearch(e.target.value)}
                                    className="pl-10"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {madeInSearch.trim() && !filteredMadeInOptions.some(loc => loc.toLowerCase() === madeInSearch.trim().toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, madeIn: madeInSearch.trim() }));
                                        setShowMadeInModal(false);
                                        setMadeInSearch('');
                                    }}
                                    className="w-full px-4 hover:bg-gray-50 rounded-md border-b border-gray-100"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-blue-600">+ Add "{madeInSearch.trim()}"</span>
                                    </div>
                                </button>
                            )}
                            
                            {filteredMadeInOptions.length === 0 && !madeInSearch.trim() ? (
                                <div className="text-center py-8 text-gray-500">
                                    <p className="text-sm">No locations available</p>
                                </div>
                            ) : filteredMadeInOptions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <p className="text-sm">No matching locations</p>
                                    <p className="text-xs mt-1">Press the button above to add custom location</p>
                                </div>
                            ) : (
                                <>
                                    {formData.madeIn && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, madeIn: undefined }));
                                                setShowMadeInModal(false);
                                                setMadeInSearch('');
                                            }}
                                            style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.375rem', borderBottom: '1px solid #e5e7eb', color: '#dc2626' }}
                                        >
                                            <span className="text-sm font-medium">✕ Clear selection</span>
                                        </button>
                                    )}
                                    {filteredMadeInOptions.map((location) => (
                                        <button
                                            key={location}
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, madeIn: location }));
                                                setShowMadeInModal(false);
                                                setMadeInSearch('');
                                            }}
                                            // className={`w-full text-left px-4 py-3 hover:bg-gray-50 rounded-md ${
                                            //     formData.madeIn === location ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                            // }`}
                                            style={{
                                                width: "100%",
                                                textAlign: "left",
                                                padding: "0.75rem 1rem",
                                                borderRadius: "0.375rem",
                                                borderBottom: "1px solid #e5e7eb",
                                                backgroundColor: formData.madeIn === location ? '#eff6ff' : 'transparent',
                                                borderLeft: formData.madeIn === location ? '4px solid #3b82f6' : '4px solid transparent',
                                            }}
                                        >
                                            <span className={`text-sm ${formData.madeIn === location ? 'font-semibold text-blue-700' : ''}`}>
                                                {location}
                                                {formData.madeIn === location && <span className="ml-2">✓</span>}
                                            </span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
