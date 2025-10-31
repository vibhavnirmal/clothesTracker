import React, { useCallback, useState, useEffect } from 'react';
import { Calendar, Check, X, Search, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { ClothesItem } from '../types';
import { ImageWithFallback } from './ImageWithFallback';

interface PhotoData {
	file: File;
	preview: string;
	date: string | null;
	selectedClothesIds: string[];
}

interface PhotoReviewModalProps {
	photos: PhotoData[];
	currentIndex: number;
	clothes: ClothesItem[];
	onNext: () => void;
	onPrevious: () => void;
	onUpdatePhoto: (index: number, updates: Partial<PhotoData>) => void;
	onClose: () => void;
	onSubmitAll: () => void;
	onAddNewClothes?: (photoIndex: number) => void;
	disableNavigation?: boolean;
}

export function PhotoReviewModal({
	photos,
	currentIndex,
	clothes,
	onNext,
	onPrevious,
	onUpdatePhoto,
	onClose,
	onSubmitAll,
	onAddNewClothes,
	disableNavigation = false,
}: PhotoReviewModalProps) {
	const [searchTerm, setSearchTerm] = useState('');
	const [touchStart, setTouchStart] = useState<number | null>(null);
	const [touchEnd, setTouchEnd] = useState<number | null>(null);
	
	const currentPhoto = photos[currentIndex];
	const totalPhotos = photos.length;

	// Minimum swipe distance (in px)
	const minSwipeDistance = 50;

	const filteredClothes = clothes.filter(item =>
		searchTerm === '' ||
		item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		item.type.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const handleToggleClothes = useCallback((clothesId: string) => {
		if (disableNavigation) return;
		const currentIds = currentPhoto.selectedClothesIds;
		const newIds = currentIds.includes(clothesId)
			? currentIds.filter(id => id !== clothesId)
			: [...currentIds, clothesId];
		
		onUpdatePhoto(currentIndex, { selectedClothesIds: newIds });
	}, [currentPhoto, currentIndex, onUpdatePhoto, disableNavigation]);

	const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		if (disableNavigation) return;
		onUpdatePhoto(currentIndex, { date: e.target.value });
	}, [currentIndex, onUpdatePhoto, disableNavigation]);

	const handleClearSelection = useCallback(() => {
		if (disableNavigation) return;
		onUpdatePhoto(currentIndex, { selectedClothesIds: [] });
	}, [currentIndex, onUpdatePhoto, disableNavigation]);

	const onTouchStart = useCallback((e: React.TouchEvent) => {
		if (disableNavigation) return;
		setTouchEnd(null);
		setTouchStart(e.targetTouches[0].clientX);
	}, [disableNavigation]);

	const onTouchMove = useCallback((e: React.TouchEvent) => {
		if (disableNavigation) return;
		setTouchEnd(e.targetTouches[0].clientX);
	}, [disableNavigation]);

	const onTouchEnd = useCallback(() => {
		if (disableNavigation) return;
		if (!touchStart || !touchEnd) return;
		
		const distance = touchStart - touchEnd;
		const isLeftSwipe = distance > minSwipeDistance;
		const isRightSwipe = distance < -minSwipeDistance;
		
		if (isLeftSwipe && currentIndex < totalPhotos - 1) {
			onNext();
		}
		if (isRightSwipe && currentIndex > 0) {
			onPrevious();
		}
	}, [touchStart, touchEnd, currentIndex, totalPhotos, onNext, onPrevious, minSwipeDistance, disableNavigation]);

	// Keyboard navigation
	useEffect(() => {
		if (disableNavigation) {
			return;
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft' && currentIndex > 0) {
				e.preventDefault();
				onPrevious();
			} else if (e.key === 'ArrowRight' && currentIndex < totalPhotos - 1) {
				e.preventDefault();
				onNext();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [currentIndex, totalPhotos, onNext, onPrevious, onClose, disableNavigation]);

	const selectedCount = currentPhoto.selectedClothesIds.length;
	const completedPhotos = photos.filter(p => p.selectedClothesIds.length > 0).length;

	return (
		<div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
            {/* screen height */}
			<div className="bg-white w-full md:w-[95vw] md:h-[95vh] md:rounded-lg flex flex-col" style={{ height: "100vh"}}>
				{/* Header */}
				<div className="p-4 border-b flex items-center justify-between bg-white flex-shrink-0">
					<div className="flex items-center gap-3">
						<Calendar className="w-5 h-5 text-blue-500" />
						<div>
							<h2 className="text-lg font-semibold">Review Photos</h2>
							<p className="text-sm text-gray-600">
								Photo {currentIndex + 1} of {totalPhotos} • {completedPhotos}/{totalPhotos} completed
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-2 hover:bg-gray-100 rounded-full transition-colors"
						aria-label="Close"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Main Content */}
				<div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    {/* Photo Info */}
                    <div className="p-4">
                        <p className="text-sm font-medium">{currentPhoto.file.name} - {(currentPhoto.file.size / 1024 / 1024).toFixed(2)} MB </p>
                    </div>
					{/* Photo Preview - Left Side */}
					<div 
						className="w-full md:w-1/2 bg-gray-900 flex flex-col items-center justify-center relative"
						onTouchStart={onTouchStart}
						onTouchMove={onTouchMove}
						onTouchEnd={onTouchEnd}
					>
						<img
							src={currentPhoto.preview}
							alt={`Photo ${currentIndex + 1}`}
							className="max-w-full rounded-lg" style={{ height: "200px"}}
						/>
						
						{/* Navigation Arrows */}
						<div className="p-4 flex justify-between px-4 gap-4">
							<Button
								onClick={(e) => {
									e.stopPropagation();
									onPrevious();
								}}
								disabled={disableNavigation || currentIndex === 0}
								className="bg-black/50 hover:bg-black/70 text-white border-0 disabled:opacity-30"
								size="lg"
								type="button"
							>
								<ChevronLeft className="w-5 h-5" />
							</Button>
							<Button
								onClick={(e) => {
									e.stopPropagation();
									onNext();
								}}
								disabled={disableNavigation || currentIndex === totalPhotos - 1}
								className="bg-black/50 hover:bg-black/70 text-white border-0 disabled:opacity-30"
								size="lg"
								type="button"
							>
								<ChevronRight className="w-5 h-5" />
							</Button>
						</div>

					</div>

					{/* Clothes Selection - Right Side */}
					<div className="w-full md:w-1/2 flex flex-col bg-white overflow-hidden">
						{/* Date Input */}
						<div className="px-4 border-b flex-shrink-0" style={{ paddingBottom: "8px"}}>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Photo Date
							</label>
							<Input
								type="date"
								value={currentPhoto.date || ''}
								onChange={handleDateChange}
								className="w-full"
							/>
							{!currentPhoto.date && (
								<p className="text-xs text-amber-600 mt-1">
									⚠️ No date found in photo metadata. Please select a date.
								</p>
							)}
						</div>

						{/* Search */}
						<div className="p-4 border-b flex-shrink-0">
							<div className="relative">
								<Search className="absolute right-2 top-2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
								<Input
									type="text"
									placeholder="Search clothes..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10"
								/>
							</div>
							{selectedCount > 0 && (
								<div className="mt-2 flex items-center justify-between">
									<p className="text-sm text-blue-600 font-medium">
										{selectedCount} item{selectedCount === 1 ? '' : 's'} selected
									</p>
									<Button
										variant="ghost"
										size="sm"
										onClick={handleClearSelection}
										className="text-gray-600 hover:text-gray-900 h-auto py-1"
									>
										Clear
									</Button>
								</div>
							)}
							{onAddNewClothes && (
								<Button
									type="button"
									variant="outline"
									className="w-full justify-start mt-3"
									style={{ marginTop: "10px", padding: "10px"}}
									onClick={() => onAddNewClothes(currentIndex)}
									disabled={disableNavigation}
								>
									<Plus className="w-4 h-4 mr-2" />
									Not in wardrobe yet? Add it now
								</Button>
							)}
						</div>

						{/* Clothes List */}

						<div className="flex-1 p-4 min-h-0 overflow-y-auto">
							<div className="grid gap-2 sm:grid-cols-1" style={{ maxHeight: "20vh"}}>
								{filteredClothes.map(item => {
									const isSelected = currentPhoto.selectedClothesIds.includes(item.id);
									return (
										<div
											key={item.id}
											onClick={() => handleToggleClothes(item.id)}
											className={`
												p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}
											`}
										>
											<div className="flex items-center gap-3">
												{/* Checkbox */}
												<div className={`
													w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}
												`}>
													{isSelected && (
														<Check className="w-3 h-3 text-white" strokeWidth={3} />
													)}
												</div>

												{/* Image/Color */}
												{item.image ? (
													<ImageWithFallback
														src={item.image}
														alt={item.name}
														className="h-12 w-12 rounded-md object-cover flex-shrink-0"
													/>
												) : (
													<div
														className="h-12 w-12 rounded-md flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
														style={{ backgroundColor: item.color || '#9CA3AF' }}
													>
														{item.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
													</div>
												)}

												{/* Details */}
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
													<p className="text-xs text-gray-500">{item.type}</p>
												</div>
											</div>
										</div>
									);
								})}
							</div>

							{filteredClothes.length === 0 && (
								<div className="text-center py-8 text-gray-500">
									<p>No clothes found matching "{searchTerm}"</p>
									{onAddNewClothes && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => onAddNewClothes(currentIndex)}
											disabled={disableNavigation}
										>
											<Plus className="w-4 h-4 mr-2" />
											Add new clothing
										</Button>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="p-4 border-t flex gap-3 justify-between bg-white flex-shrink-0">
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<div className="flex gap-3">
						{currentIndex < totalPhotos - 1 ? (
							<Button
                variant={'outline'}
								onClick={onNext}
								className=""
								disabled={disableNavigation}
							>
								Next Photo
								<ChevronRight className="w-4 h-4 ml-1" />
							</Button>
						) : (
							<Button
                variant={'outline'}
								onClick={onSubmitAll}
								className="bg-green-100 hover:cursor-pointer"
								disabled={disableNavigation || photos.some(p => !p.date)}
							>
								<Check className="w-4 h-4 mr-2" />
								Submit All ({completedPhotos} photos)
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
