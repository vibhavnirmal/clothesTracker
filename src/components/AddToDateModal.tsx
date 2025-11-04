import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, X, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { ClothesItem } from '../types';
import { ImageWithFallback } from './ImageWithFallback';

interface AddToDateModalProps {
	clothes: ClothesItem[];
	date: string;
	onAdd: (clothesIds: string[], date: string) => Promise<void>;
	onClose: () => void;
	disabledClothesIds?: string[];
}

export function AddToDateModal({ clothes, date, onAdd, onClose, disabledClothesIds }: AddToDateModalProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [searchTerm, setSearchTerm] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const disabledSet = useMemo(() => new Set(disabledClothesIds ?? []), [disabledClothesIds]);

	useEffect(() => {
		setSelectedIds(prev => {
			let changed = false;
			const next = new Set(prev);
			disabledSet.forEach(id => {
				if (next.has(id)) {
					next.delete(id);
					changed = true;
				}
			});
			return changed ? next : prev;
		});
	}, [disabledSet]);

	const formattedDate = useMemo(() => {
		const d = new Date(date + 'T00:00:00');
		return d.toLocaleDateString('en-US', { 
			weekday: 'long',
			year: 'numeric', 
			month: 'long', 
			day: 'numeric' 
		});
	}, [date]);

	const filteredClothes = useMemo(() => {
		if (!searchTerm) return clothes;
		const lower = searchTerm.toLowerCase();
		return clothes.filter(item =>
			item.name.toLowerCase().includes(lower) ||
			item.type.toLowerCase().includes(lower)
		);
	}, [clothes, searchTerm]);

	const handleToggle = useCallback((id: string) => {
		if (disabledSet.has(id)) {
			return;
		}
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, [disabledSet]);

	const handleSubmit = useCallback(async () => {
		const idsToAdd = Array.from(selectedIds).filter(id => !disabledSet.has(id));
		if (idsToAdd.length === 0) return;

		setIsSubmitting(true);
		try {
			await onAdd(idsToAdd, date);
			onClose();
		} catch (error) {
			console.error('Failed to add clothes to date:', error);
		} finally {
			setIsSubmitting(false);
		}
	}, [selectedIds, disabledSet, date, onAdd, onClose]);

	const handleClear = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" 
        style={{ height: '100vh' }}>
			<div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
                style={{ maxHeight: '85vh' }}>
				{/* Header */}
				<div className="p-4 border-b flex items-center justify-between flex-shrink-0">
					<div className="flex items-center gap-3">
						<Calendar className="w-5 h-5 text-blue-500" />
						<div>
							<h2 className="text-lg font-semibold">Add Clothes to Date</h2>
							<p className="text-sm text-gray-600">{formattedDate}</p>
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
					{selectedIds.size > 0 && (
						<div className="mt-2 flex items-center justify-between">
							<p className="text-sm text-blue-600 font-medium">
								{selectedIds.size} item{selectedIds.size === 1 ? '' : 's'} selected
							</p>
							<Button 
								variant="ghost" 
								size="sm"
								onClick={handleClear}
								className="text-gray-600 hover:text-gray-900 h-auto py-1"
							>
								Clear selection
							</Button>
						</div>
					)}
				</div>

				{/* Clothes List */}
				<div className="flex-1 overflow-y-auto p-4 min-h-0">
					<div className="grid gap-3 sm:grid-cols-2">
						{filteredClothes.map(item => {
							const isDisabled = disabledSet.has(item.id);
							const isSelected = !isDisabled && selectedIds.has(item.id);

							const cardClasses = [
								'rounded-lg border p-3 transition-all',
								isDisabled ? 'cursor-not-allowed bg-gray-50 border-gray-200 opacity-50' : 'cursor-pointer bg-white hover:border-gray-300',
								isSelected ? 'border-blue-500 bg-blue-50' : ''
							].filter(Boolean).join(' ');

							const checkboxClasses = [
								'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
								isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white text-transparent',
								isDisabled ? 'border-dashed' : ''
							].filter(Boolean).join(' ');

							return (
								<div
									key={item.id}
									onClick={() => {
										if (!isDisabled) {
											handleToggle(item.id);
										}
									}}
									className={cardClasses}
									aria-disabled={isDisabled}
								>
									<div className="flex items-center gap-3">
										{/* Checkbox */}
										<div className={checkboxClasses}>
											{isSelected && (
												<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
												</svg>
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
											<div className="flex items-start justify-between gap-2">
												<p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
												{isDisabled && (
													<span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
														<svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
															<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.75 11.086l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
														</svg>
														Logged
													</span>
												)}
											</div>
											<p className="text-xs text-gray-500">
												{item.type}
											</p>
										</div>
									</div>
								</div>
							);
						})}
					</div>

					{filteredClothes.length === 0 && (
						<div className="text-center py-8 text-gray-500">
							<p>No clothes found matching "{searchTerm}"</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="p-4 border-t flex gap-3 justify-between flex-shrink-0 bg-white">
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						variant="outline"
						onClick={handleSubmit}
						disabled={selectedIds.size === 0 || isSubmitting}
						className="text-black bg-white cursor-pointer"
					>
						<Plus className="w-4 h-4 mr-2" />
						{isSubmitting ? 'Adding...' : `Add ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}`}
					</Button>
				</div>
			</div>
		</div>
	);
}
