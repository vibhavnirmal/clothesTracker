import React, { useCallback, useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X, Calendar, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { PhotoReviewModal } from './PhotoReviewModal';
import type { ClothesItem } from '../types';
import exifr from 'exifr';

interface PhotoData {
	file: File;
	preview: string;
	date: string | null;
	selectedClothesIds: string[];
}

interface BulkPhotoUploadProps {
	clothes: ClothesItem[];
	onSubmit: (photos: PhotoData[]) => Promise<void>;
}

export function BulkPhotoUpload({ clothes, onSubmit }: BulkPhotoUploadProps) {
	const [photos, setPhotos] = useState<PhotoData[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [showReview, setShowReview] = useState(false);
	const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const formatDateToISO = (date: Date): string => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	const extractExifDate = async (file: File): Promise<string | null> => {
		try {
			const exifData = await exifr.parse(file, {
				pick: ['DateTimeOriginal', 'DateTime', 'CreateDate']
			});
			
			if (exifData) {
				const date = exifData.DateTimeOriginal || exifData.DateTime || exifData.CreateDate;
				if (date instanceof Date) {
					return formatDateToISO(date);
				}
			}
		} catch (error) {
			console.warn('Failed to extract EXIF data from', file.name, error);
		}
		
		// Fallback: use file's last modified date
		return formatDateToISO(new Date(file.lastModified));
	};

	const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		setIsProcessing(true);
		
		const newPhotos: PhotoData[] = [];
		
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			
			// Only process image files
			if (!file.type.startsWith('image/')) continue;
			
			// Create preview URL
			const preview = URL.createObjectURL(file);
			
			// Extract EXIF date
			const date = await extractExifDate(file);
			
			newPhotos.push({
				file,
				preview,
				date,
				selectedClothesIds: [],
			});
		}
		
		setPhotos(prev => [...prev, ...newPhotos]);
		setIsProcessing(false);
		
		// Reset input
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	}, []);

	const handleRemovePhoto = useCallback((index: number) => {
		setPhotos(prev => {
			const newPhotos = [...prev];
			// Revoke object URL to free memory
			URL.revokeObjectURL(newPhotos[index].preview);
			newPhotos.splice(index, 1);
			return newPhotos;
		});
	}, []);

	const handleStartReview = useCallback(() => {
		if (photos.length === 0) return;
		setCurrentReviewIndex(0);
		setShowReview(true);
	}, [photos]);

	const handleNextPhoto = useCallback(() => {
		if (currentReviewIndex < photos.length - 1) {
			setCurrentReviewIndex(prev => prev + 1);
		}
	}, [currentReviewIndex, photos.length]);

	const handlePreviousPhoto = useCallback(() => {
		if (currentReviewIndex > 0) {
			setCurrentReviewIndex(prev => prev - 1);
		}
	}, [currentReviewIndex]);

	const handleUpdatePhoto = useCallback((index: number, updates: Partial<PhotoData>) => {
		setPhotos(prev => {
			const newPhotos = [...prev];
			newPhotos[index] = { ...newPhotos[index], ...updates };
			return newPhotos;
		});
	}, []);

	const handleSubmitAll = useCallback(async () => {
		// Filter out photos without dates or clothes
		const validPhotos = photos.filter(p => p.date && p.selectedClothesIds.length > 0);
		
		if (validPhotos.length === 0) {
			alert('Please select at least one photo with a date and clothes items.');
			return;
		}

		setIsSubmitting(true);
		try {
			await onSubmit(validPhotos);
			
			// Clean up object URLs
			photos.forEach(photo => URL.revokeObjectURL(photo.preview));
			
			// Reset state
			setPhotos([]);
			setShowReview(false);
			setCurrentReviewIndex(0);
		} catch (error) {
			console.error('Failed to submit photos:', error);
			alert('Failed to submit photos. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	}, [photos, onSubmit]);

	const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		const files = event.dataTransfer.files;
		
		if (files && files.length > 0) {
			// Simulate file input change
			const changeEvent = {
				target: { files }
			} as React.ChangeEvent<HTMLInputElement>;
			handleFileSelect(changeEvent);
		}
	}, [handleFileSelect]);

	const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
	}, []);

	const photosWithClothes = photos.filter(p => p.selectedClothesIds.length > 0).length;
	const photosWithDates = photos.filter(p => p.date).length;

	return (
		<div className="max-w-4xl mx-auto" style={{ paddingBottom: '6rem' }}>
			<div className="p-4 space-y-4">
				{/* Header */}
				{/* <div className="flex items-center gap-3 mb-6">
					<Upload className="w-5 h-5 text-blue-500" />
					<div>
						<h1 className="text-xl font-semibold">Upload Photos</h1>
						<p className="text-sm text-gray-600">Upload multiple photos and tag your outfits</p>
					</div>
				</div> */}

				{/* Upload Area */}
				<div
					onDrop={handleDrop}
					onDragOver={handleDragOver}
					className="border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors bg-white"
				>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						multiple
						onChange={handleFileSelect}
						id="photo-upload"
                        style={{ padding: "10px", display: 'none' }}
					/>
					<label htmlFor="photo-upload" className="cursor-pointer">
						<Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
						<p className="text-lg font-medium text-gray-700 mb-2">
							Click to upload or drag and drop
						</p>
						<p className="text-sm text-gray-500">
							Upload multiple photos (JPG, PNG, HEIC)
						</p>
					</label>
				</div>

				{isProcessing && (
					<div className="text-center py-4">
						<p className="text-sm text-gray-600">Processing photos...</p>
					</div>
				)}

				{/* Photo Grid */}
				{photos.length > 0 && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold">
								Uploaded Photos ({photos.length})
							</h2>
							<Button
                            variant={'outline'}
								onClick={handleStartReview}
								className="bg-blue-600 hover:bg-blue-700 text-black"
							>
								Review & Tag Photos
							</Button>
						</div>

						{/* Status Summary */}
						<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
							<div className="flex items-start gap-3">
								<AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
								<div className="flex-1">
									<p className="text-sm font-medium text-blue-900 mb-1">Review Status</p>
									<ul className="text-sm text-blue-700 space-y-1">
										<li>✓ {photosWithDates}/{photos.length} photos have dates</li>
										<li>✓ {photosWithClothes}/{photos.length} photos have clothes tagged</li>
									</ul>
									{photos.length > photosWithClothes && (
										<p className="text-xs text-blue-600 mt-2">
											Click "Review & Tag Photos" to add clothes to each photo
										</p>
									)}
								</div>
							</div>
						</div>

						{/* Photo Thumbnails */}
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
							{photos.map((photo, index) => (
								<div
									key={index}
									className="relative group rounded-lg overflow-hidden border-2 border-gray-200 bg-white"
								>
									<img
										src={photo.preview}
										alt={photo.file.name}
										className="w-full h-40 object-cover"
									/>
									
									{/* Remove Button */}
									<button
										onClick={() => handleRemovePhoto(index)}
										className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<X className="w-4 h-4" />
									</button>

									{/* Info Overlay */}
									<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
										<div className="flex items-center gap-1 text-white text-xs mb-1">
											<Calendar className="w-3 h-3" />
											<span>{photo.date || 'No date'}</span>
										</div>
										<div className="flex items-center gap-1 text-white text-xs">
											<ImageIcon className="w-3 h-3" />
											<span>
												{photo.selectedClothesIds.length === 0
													? 'No items'
													: `${photo.selectedClothesIds.length} item${photo.selectedClothesIds.length === 1 ? '' : 's'}`
												}
											</span>
										</div>
									</div>

									{/* Status Badge */}
									{photo.date && photo.selectedClothesIds.length > 0 && (
										<div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
											✓ Ready
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Review Modal */}
			{showReview && photos.length > 0 && (
				<PhotoReviewModal
					photos={photos}
					currentIndex={currentReviewIndex}
					clothes={clothes}
					onNext={handleNextPhoto}
					onPrevious={handlePreviousPhoto}
					onUpdatePhoto={handleUpdatePhoto}
					onClose={() => setShowReview(false)}
					onSubmitAll={handleSubmitAll}
				/>
			)}
		</div>
	);
}
