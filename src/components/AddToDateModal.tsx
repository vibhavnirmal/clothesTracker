import React, { useCallback, useMemo, useState } from 'react';
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
}

export function AddToDateModal({ clothes, date, onAdd, onClose }: AddToDateModalProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [searchTerm, setSearchTerm] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

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
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const handleSubmit = useCallback(async () => {
		if (selectedIds.size === 0) return;

		setIsSubmitting(true);
		try {
			await onAdd(Array.from(selectedIds), date);
			onClose();
		} catch (error) {
			console.error('Failed to add clothes to date:', error);
		} finally {
			setIsSubmitting(false);
		}
	}, [selectedIds, date, onAdd, onClose]);

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
							const isSelected = selectedIds.has(item.id);
							return (
								<div
									key={item.id}
									onClick={() => handleToggle(item.id)}
									className={`rounded-lg p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
								>
									<div className="flex items-center gap-3">
										{/* Checkbox */}
										<div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'}`}>
											{isSelected && (
												<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
