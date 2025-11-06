import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Droplets, Search, Shirt, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { ClothesItem } from '../types';
import { ImageWithFallback } from './ImageWithFallback';

interface AddToDateModalProps {
	clothes: ClothesItem[];
	date: string;
	onAddWear?: (clothesIds: string[], date: string) => Promise<void>;
	onAddWash?: (clothesIds: string[], date: string) => Promise<void>;
	onClose: () => void;
	disabledWearClothesIds?: string[];
	disabledWashClothesIds?: string[];
}

type SubmissionAction = 'wear' | 'wash';

export function AddToDateModal({
	clothes,
	date,
	onAddWear,
	onAddWash,
	onClose,
	disabledWearClothesIds,
	disabledWashClothesIds,
}: AddToDateModalProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [searchTerm, setSearchTerm] = useState('');
	const [submittingAction, setSubmittingAction] = useState<SubmissionAction | null>(null);

	const disabledWearSet = useMemo(() => new Set(disabledWearClothesIds ?? []), [disabledWearClothesIds]);
	const disabledWashSet = useMemo(() => new Set(disabledWashClothesIds ?? []), [disabledWashClothesIds]);

	useEffect(() => {
		if (disabledWearSet.size === 0 && disabledWashSet.size === 0) {
			return;
		}

		setSelectedIds(prev => {
			let changed = false;
			const next = new Set(prev);
			next.forEach(id => {
				if (disabledWearSet.has(id) && disabledWashSet.has(id)) {
					next.delete(id);
					changed = true;
				}
			});
			return changed ? next : prev;
		});
	}, [disabledWearSet, disabledWashSet]);

	const formattedDate = useMemo(() => {
		const d = new Date(date + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
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

	const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);

	const handleToggle = useCallback((id: string) => {
		const isFullyLogged = disabledWearSet.has(id) && disabledWashSet.has(id);
		if (isFullyLogged) {
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
	}, [disabledWearSet, disabledWashSet]);

	const canSubmitWear = useMemo(() => {
		if (!onAddWear) return false;
		return selectedList.some(id => !disabledWearSet.has(id));
	}, [onAddWear, selectedList, disabledWearSet]);

	const canSubmitWash = useMemo(() => {
		if (!onAddWash) return false;
		return selectedList.some(id => !disabledWashSet.has(id));
	}, [onAddWash, selectedList, disabledWashSet]);

	const handleSubmit = useCallback(async (action: SubmissionAction) => {
		const handler = action === 'wear' ? onAddWear : onAddWash;
		if (!handler) {
			return;
		}

		const disallowedSet = action === 'wear' ? disabledWearSet : disabledWashSet;
		const idsToSubmit = selectedList.filter(id => !disallowedSet.has(id));
		if (idsToSubmit.length === 0) {
			return;
		}

		setSubmittingAction(action);
		try {
			await handler(idsToSubmit, date);
			setSelectedIds(new Set());
			onClose();
		} catch (error) {
			console.error(`Failed to add clothes to ${action}:`, error);
		} finally {
			setSubmittingAction(null);
		}
	}, [disabledWearSet, disabledWashSet, onAddWear, onAddWash, selectedList, date, onClose]);

	const handleClear = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" style={{ height: '100vh' }}>
			<div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
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
					{selectedList.length > 0 && (
						<div className="mt-2 flex items-center justify-between">
							<p className="text-sm text-blue-600 font-medium">
								{selectedList.length} item{selectedList.length === 1 ? '' : 's'} selected
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
							const isWearLogged = disabledWearSet.has(item.id);
							const isWashLogged = disabledWashSet.has(item.id);
							const isFullyLogged = isWearLogged && isWashLogged;
							const isSelected = selectedIds.has(item.id);

							const cardClasses = [
								'rounded-lg border p-3 transition-all',
								isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white',
								isFullyLogged ? 'cursor-not-allowed opacity-50 bg-gray-50 border-gray-200' : 'cursor-pointer hover:border-gray-300',
							].join(' ');

							const checkboxClasses = [
								'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
								isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white text-transparent',
								isFullyLogged ? 'border-dashed' : '',
							].join(' ');

							return (
								<div
									key={item.id}
									onClick={() => handleToggle(item.id)}
									className={cardClasses}
									aria-disabled={isFullyLogged}
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
												<div className="flex gap-1">
													{isWearLogged && (
														<span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
															<Shirt className="h-3 w-3" />
															Worn
														</span>
													)}
													{isWashLogged && (
														<span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
															<Droplets className="h-3 w-3" />
															Washed
														</span>
													)}
												</div>
											</div>
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
				<div className="p-4 border-t flex flex-col gap-3 flex-shrink-0 bg-white sm:flex-row sm:items-center sm:justify-between">
					<Button variant="outline" onClick={onClose} disabled={submittingAction !== null}>
						Cancel
					</Button>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<Button
							type="button"
							variant="outline"
							onClick={() => handleSubmit('wear')}
							disabled={!canSubmitWear || submittingAction !== null}
							className="flex items-center gap-2"
						>
							<Shirt className="h-4 w-4" />
							{submittingAction === 'wear' ? 'Saving...' : 'Mark Worn'}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleSubmit('wash')}
							disabled={!canSubmitWash || submittingAction !== null}
							className="flex items-center gap-2"
						>
							<Droplets className="h-4 w-4" />
							{submittingAction === 'wash' ? 'Saving...' : 'Mark Washed'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
