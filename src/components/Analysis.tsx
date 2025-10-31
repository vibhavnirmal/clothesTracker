import { useMemo, useState, useEffect } from 'react';
import { Activity, Shirt, X, Filter } from 'lucide-react';
import type { ClothesItem, WearRecord, WashRecord } from '../types';
import { getColorName } from '../lib/colors';
import { ImageWithFallback } from './ImageWithFallback';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface AnalysisProps {
	clothes: ClothesItem[];
	wearRecords: WearRecord[];
	washRecords: WashRecord[];
}

interface ItemSummary {
	item: ClothesItem;
	totalWearCount: number;
	totalWashCount: number;
	averageWearsPerWash: number | null;
}

export function Analysis({ clothes, wearRecords, washRecords }: AnalysisProps) {
	const [selectedImage, setSelectedImage] = useState<{ src: string; name: string } | null>(null);
	const [materialFilter, setMaterialFilter] = useState<string>('all');
	
	// Prevent body scroll when modal is open
	useEffect(() => {
		if (selectedImage) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [selectedImage]);
	
	const { totals, perItemSummaries, topWorn, topWashed, typeBreakdown, materialBreakdown, availableMaterials } = useMemo(() => {
		// Filter clothes by selected material
		const filteredClothes = materialFilter === 'all' 
			? clothes 
			: clothes.filter(item => {
				if (!item.materials) return false;
				return Object.keys(item.materials).some(mat => mat.toLowerCase() === materialFilter.toLowerCase());
			});

		const wearCountMap = new Map<string, number>();
		const washCountMap = new Map<string, number>();

		wearRecords.forEach(record => {
			wearCountMap.set(record.clothesId, (wearCountMap.get(record.clothesId) ?? 0) + 1);
		});

		washRecords.forEach(record => {
			washCountMap.set(record.clothesId, (washCountMap.get(record.clothesId) ?? 0) + 1);
		});

		const perItemSummaries: ItemSummary[] = filteredClothes.map(item => {
			const totalWearCount = wearCountMap.get(item.id) ?? 0;
			const totalWashCount = washCountMap.get(item.id) ?? 0;
			const averageWearsPerWash = totalWashCount > 0
				? Number((totalWearCount / totalWashCount).toFixed(1))
				: (totalWearCount > 0 ? totalWearCount : null);

			return {
				item,
				totalWearCount,
				totalWashCount,
				averageWearsPerWash,
			};
		});

		const topWornItems = [...perItemSummaries]
			.filter(summary => summary.totalWearCount > 0)
			.sort((a, b) => b.totalWearCount - a.totalWearCount)
			.slice(0, 5);

		const topWashedItems = [...perItemSummaries]
			.filter(summary => summary.totalWashCount > 0)
			.sort((a, b) => b.totalWashCount - a.totalWashCount)
			.slice(0, 5);

		// Calculate type breakdown
		const typeCountMap = new Map<string, number>();
		filteredClothes.forEach(item => {
			const type = item.type || 'Uncategorized';
			typeCountMap.set(type, (typeCountMap.get(type) ?? 0) + 1);
		});

		const typeBreakdownArray = Array.from(typeCountMap.entries())
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count);

		const maxTypeCount = Math.max(...typeBreakdownArray.map(t => t.count), 1);

		// Calculate material breakdown across ALL clothes (not filtered)
		const materialCountMap = new Map<string, { count: number; totalPercentage: number }>();
		clothes.forEach(item => {
			if (item.materials) {
				Object.entries(item.materials).forEach(([material, percentage]) => {
					const existing = materialCountMap.get(material) || { count: 0, totalPercentage: 0 };
					materialCountMap.set(material, {
						count: existing.count + 1,
						totalPercentage: existing.totalPercentage + percentage,
					});
				});
			}
		});

		const materialBreakdownArray = Array.from(materialCountMap.entries())
			.map(([material, data]) => ({
				material,
				count: data.count,
				averagePercentage: Math.round(data.totalPercentage / data.count),
			}))
			.sort((a, b) => b.count - a.count);

		const maxMaterialCount = Math.max(...materialBreakdownArray.map(m => m.count), 1);

		// Get all unique materials for filter dropdown
		const allMaterials = Array.from(materialCountMap.keys()).sort();

		return {
			totals: {
				uniqueItems: filteredClothes.length,
				totalWearEntries: wearRecords.length,
				totalWashEntries: washRecords.length,
				neverWashedCount: perItemSummaries.filter(summary => summary.totalWashCount === 0).length,
				neverWornCount: perItemSummaries.filter(summary => summary.totalWearCount === 0).length,
			},
			perItemSummaries,
			topWorn: topWornItems,
			topWashed: topWashedItems,
			typeBreakdown: typeBreakdownArray.map(item => ({
				...item,
				percentage: Math.round((item.count / filteredClothes.length) * 100),
				barWidth: Math.round((item.count / maxTypeCount) * 100),
			})),
			materialBreakdown: materialBreakdownArray.map(item => ({
				...item,
				percentage: Math.round((item.count / clothes.length) * 100),
				barWidth: Math.round((item.count / maxMaterialCount) * 100),
			})),
			availableMaterials: allMaterials,
		};
	}, [clothes, wearRecords, washRecords, materialFilter]);

	// // Debug log
	// useEffect(() => {
	// 	console.log('Type Breakdown Data:', typeBreakdown);
	// }, [typeBreakdown]);

	type SortColumn = 'name' | 'type' | 'color' | 'totalWearCount' | 'totalWashCount' | 'averageWearsPerWash' | 'wearsSinceWash';
	type SortDirection = 'asc' | 'desc';

	const [sortColumn, setSortColumn] = useState<SortColumn>('totalWearCount');
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

	const sortedPerItem = useMemo(() => {
		const items = [...perItemSummaries];

		const getComparableValue = (summary: ItemSummary): string | number | null => {
			switch (sortColumn) {
				case 'name':
					return summary.item.name.toLowerCase();
				case 'type':
					return summary.item.type.toLowerCase();
				case 'color':
					return getColorName(summary.item.color).toLowerCase();
				case 'totalWearCount':
					return summary.totalWearCount;
				case 'totalWashCount':
					return summary.totalWashCount;
				case 'averageWearsPerWash':
					return summary.averageWearsPerWash;
				case 'wearsSinceWash':
					return summary.item.wearsSinceWash ?? 0;
			}
		};

		items.sort((a, b) => {
			const aValue = getComparableValue(a);
			const bValue = getComparableValue(b);

			if (aValue === bValue) {
				return a.item.name.localeCompare(b.item.name);
			}

			if (aValue === null || aValue === undefined) {
				return sortDirection === 'asc' ? 1 : -1;
			}

			if (bValue === null || bValue === undefined) {
				return sortDirection === 'asc' ? -1 : 1;
			}

			if (typeof aValue === 'string' && typeof bValue === 'string') {
				return sortDirection === 'asc'
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue);
			}

			const numericComparison = (aValue as number) - (bValue as number);
			return sortDirection === 'asc' ? numericComparison : -numericComparison;
		});

		return items;
	}, [perItemSummaries, sortColumn, sortDirection]);

	const handleSort = (column: SortColumn) => {
		const defaultDirection: SortDirection = column === 'name' || column === 'type' || column === 'color' ? 'asc' : 'desc';

		if (sortColumn === column) {
			setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
			return;
		}

		setSortColumn(column);
		setSortDirection(defaultDirection);
	};

	const getSortIndicator = (column: SortColumn) => {
		if (sortColumn !== column) {
			return null;
		}
		return sortDirection === 'asc' ? '↑' : '↓';
	};

	return (
		<div className="" style={{ paddingBottom: '5rem', maxWidth: '800px', margin: '0 auto' }}>
			<div className="p-4 space-y-6">
				{/* <header className="flex items-center gap-3 mb-6">
					<h1 className="flex items-center gap-2">
						<Activity className="w-5 h-5 text-blue-500" />
						Analysis
					</h1>
				</header> */}

				<section className="grid grid-cols-1 gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
					<div className="flex justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-4">
						<div>
							<p className="text-sm uppercase tracking-wide text-blue-600">Total wear entries</p>
							<p className="text-xs text-gray-500">All-time wears recorded</p>
						</div>
						<div>
							<p className="text-2xl font-semibold text-blue-900">{totals.totalWearEntries}</p>
						</div>
					</div>

					<div className="flex justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
						<div>
							<p className="text-sm uppercase tracking-wide text-blue-600">Total wash entries</p>
							<p className="text-xs text-gray-500">All-time washes recorded</p>
						</div>
						<div>
							<p className="text-2xl font-semibold text-emerald-900">{totals.totalWashEntries}</p>
						</div>
					</div>

					<div className="flex justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
						<div>
							<p className="text-sm uppercase tracking-wide text-blue-600">Items tracked</p>
							<p className="text-xs text-gray-500">Total unique clothing items</p>
						</div>
						<div>
							<p className="text-2xl font-semibold text-gray-900">{totals.uniqueItems}</p>
						</div>
					</div>

					{/* <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-700">Needs attention</p>
            <p className="text-lg font-semibold text-amber-800">{totals.neverWashedCount} never washed</p>
            <p className="text-xs text-amber-700/70">{totals.neverWornCount} never worn</p>
          </div> */}
				</section>

				{/* Material Filter */}
				{availableMaterials.length > 0 && (
					<section className="mb-4">
						<div className="rounded-xl border border-gray-200 bg-white p-4">
							<div className="flex items-center justify-between gap-3 flex-wrap">
								<div className="flex items-center gap-2 text-gray-700">
									<Filter className="h-4 w-4" />
									<p className="text-sm font-semibold">Filter by Material</p>
								</div>
								<Select value={materialFilter} onValueChange={setMaterialFilter}>
									<SelectTrigger className="w-[180px]">
										<SelectValue placeholder="All Materials" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Materials</SelectItem>
										{availableMaterials.map(material => (
											<SelectItem key={material} value={material}>
												{material}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{materialFilter !== 'all' && (
								<div className="mt-3 flex items-center gap-2">
									<span className="text-xs text-gray-500">
										Showing {totals.uniqueItems} item{totals.uniqueItems !== 1 ? 's' : ''} with {materialFilter}
									</span>
									<button
										onClick={() => setMaterialFilter('all')}
										className="text-xs text-blue-600 hover:text-blue-700 font-medium"
									>
										Clear filter
									</button>
								</div>
							)}
						</div>
					</section>
				)}

				{/* Wardrobe Composition by Type */}
				<section className="mb-4">
					<div className="rounded-xl border border-purple-100 bg-white p-4">
						<div className="flex items-center gap-2 text-purple-600 mb-4">
							<Shirt className="h-4 w-4" />
							<p className="text-sm font-semibold uppercase tracking-wide">Wardrobe Composition by Type</p>
						</div>
						
						{typeBreakdown.length === 0 ? (
							<p className="text-xs text-gray-500">No clothes added yet.</p>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
								{typeBreakdown.map(({ type, count, percentage, barWidth }) => (
									<div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}>
											<span style={{ fontWeight: '500', color: '#374151' }}>{type}</span>
											<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
												<span style={{ fontSize: '12px', color: '#6B7280' }}>{percentage}%</span>
												<span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{count}</span>
											</div>
										</div>
										<div style={{ 
											width: '100%', 
											height: '8px', 
											backgroundColor: '#F3F4F6', 
											borderRadius: '9999px',
											overflow: 'hidden'
										}}>
											<div
												style={{ 
													height: '100%', 
													background: 'linear-gradient(to right, #A855F7, #C084FC)',
													borderRadius: '9999px',
													width: `${barWidth}%`,
													transition: 'width 0.5s ease-out'
												}}
											/>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</section>

				{/* Material Distribution */}
				<section className="mb-4">
					<div className="rounded-xl border border-indigo-100 bg-white p-4">
						<div className="flex items-center gap-2 text-indigo-600 mb-4">
							<Activity className="h-4 w-4" />
							<p className="text-sm font-semibold uppercase tracking-wide">Material Distribution</p>
						</div>
						
						{materialBreakdown.length === 0 ? (
							<p className="text-xs text-gray-500">No material data available. Add materials to your clothes.</p>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
								{materialBreakdown.map(({ material, count, percentage, averagePercentage, barWidth }) => (
									<div key={material} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
										<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}>
											<span style={{ fontWeight: '500', color: '#374151' }}>{material}</span>
											<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
												<span style={{ fontSize: '11px', color: '#6B7280' }}>~{averagePercentage}% avg</span>
												<span style={{ fontSize: '12px', color: '#6B7280' }}>{percentage}%</span>
												<span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{count}</span>
											</div>
										</div>
										<div style={{ 
											width: '100%', 
											height: '8px', 
											backgroundColor: '#F3F4F6', 
											borderRadius: '9999px',
											overflow: 'hidden'
										}}>
											<div
												style={{ 
													height: '100%', 
													background: 'linear-gradient(to right, #6366F1, #818CF8)',
													borderRadius: '9999px',
													width: `${barWidth}%`,
													transition: 'width 0.5s ease-out'
												}}
											/>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</section>

				<section className="mb-4">
					<div className="rounded-xl border border-blue-100 bg-white p-4">
						<div className="flex items-center gap-2 text-blue-600" style={{ marginBottom: '0.75rem' }}>
							<Shirt className="h-4 w-4" />
							<p className="text-sm font-semibold uppercase tracking-wide">Top {topWorn.length} worn items</p>
						</div>
						{topWorn.length === 0 ? (
							<p className="mt-3 text-xs text-gray-500">No wear activity yet.</p>
						) : (
							<ul className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
								{topWorn.map(({ item, totalWearCount }) => (
									<li key={item.id} className="rounded-lg border border-blue-50 bg-blue-50/60 px-3 py-2">
										<div className="flex items-center gap-3">
											{item.image ? (
												<button
													type="button"
													onClick={() => setSelectedImage({ src: item.image!, name: item.name })}
													className="h-12 w-12 rounded-md flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
												>
													<ImageWithFallback
														src={item.image}
														alt={item.name}
														className="h-full w-full object-cover"
													/>
												</button>
											) : (
												<div
													className="h-12 w-12 rounded-md flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
													style={{ backgroundColor: item.color || '#9CA3AF' }}
												>
													{item.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
												</div>
											)}
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
												<p className="text-xs text-gray-500">
													{item.type} • {totalWearCount} wear{totalWearCount !== 1 ? 's' : ''}
												</p>
											</div>
										</div>
									</li>
								))}
							</ul>
						)}

					</div>
				</section>

				<section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
					<div className="flex flex-col items-center justify-between gap-3 mb-4">
						<h2 className="text-sm font-semibold text-blue-600">Per-item breakdown</h2>
						<p className="text-xs text-gray-500">
							Sorted by {sortColumn === 'name' ? 'item' : sortColumn.replace(/([A-Z])/g, ' $1').toLowerCase()} ({sortDirection})
						</p>
					</div>

					{perItemSummaries.length === 0 ? (
						<p className="mt-4 text-xs text-gray-500">Add some clothes to start tracking analysis.</p>
					) : (
						<div className="mt-4 overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200 text-left text-sm">
								<thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b">
									<tr>
										<th scope="col" className="px-3 py-2">
											<button type="button" className="flex items-center gap-1" onClick={() => handleSort('name')}>
												Item {getSortIndicator('name') && <span>{getSortIndicator('name')}</span>}
											</button>
										</th>
										<th scope="col" className="px-3 py-2">
											<button type="button" className="flex items-center gap-1" onClick={() => handleSort('type')}>
												Type {getSortIndicator('type') && <span>{getSortIndicator('type')}</span>}
											</button>
										</th>
										<th scope="col" className="px-3 py-2">
											<button type="button" className="flex items-center gap-1" onClick={() => handleSort('color')}>
												Color {getSortIndicator('color') && <span>{getSortIndicator('color')}</span>}
											</button>
										</th>
										<th scope="col" className="px-3 py-2 text-right">
											<button type="button" className="flex items-center gap-1" onClick={() => handleSort('totalWearCount')}>
												Total wears {getSortIndicator('totalWearCount') && <span>{getSortIndicator('totalWearCount')}</span>}
											</button>
										</th>
										<th scope="col" className="px-3 py-2 text-right">
											<button type="button" className="flex items-center gap-1" onClick={() => handleSort('totalWashCount')}>
												Total washes {getSortIndicator('totalWashCount') && <span>{getSortIndicator('totalWashCount')}</span>}
											</button>
										</th>
										<th scope="col" className="px-3 py-2 text-right">
											<button type="button" className="flex items-center gap-1" onClick={() => handleSort('averageWearsPerWash')}>
												Avg wears / wash {getSortIndicator('averageWearsPerWash') && <span>{getSortIndicator('averageWearsPerWash')}</span>}
											</button>
										</th>
										<th scope="col" className="px-3 py-2 text-right">
											<button type="button" className="flex items-center gap-1" onClick={() => handleSort('wearsSinceWash')}>
												Current wears since wash {getSortIndicator('wearsSinceWash') && <span>{getSortIndicator('wearsSinceWash')}</span>}
											</button>
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100">
									{sortedPerItem.map(({ item, totalWearCount, totalWashCount, averageWearsPerWash }) => (
										<tr key={item.id} className="text-sm text-gray-700">
											<td className="px-3 py-3">
												<div className="flex items-center gap-2">
													<span
														className="h-3 w-3 rounded-full border border-gray-300"
														style={{ backgroundColor: item.color || '#e5e7eb' }}
													/>
													<span className="truncate" style={{ maxWidth: '6rem' }}>{item.name}</span>
												</div>
											</td>
											<td className="px-3 py-3 text-gray-500 truncate" style={{ maxWidth: '6rem' }}>{item.type}</td>
											<td className="px-3 py-3 text-gray-500">{getColorName(item.color)}</td>
											<td className="px-3 py-3 text-right font-medium">{totalWearCount}</td>
											<td className="px-3 py-3 text-right font-medium">{totalWashCount}</td>
											<td className="px-3 py-3 text-right text-gray-500">
												{averageWearsPerWash === null ? '—' : averageWearsPerWash}
											</td>
											<td className="px-3 py-3 text-right text-gray-500">{item.wearsSinceWash}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			</div>

			{/* Image Modal */}
			{selectedImage && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
					style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
					onClick={() => setSelectedImage(null)}
				>
					<div className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-8">
						<Button
							variant="ghost"
							size="icon"
							className="absolute hover:bg-white text-white z-10 rounded-full"
							style={{ top: "10px", right: "10px"}}
							onClick={() => setSelectedImage(null)}
						>
							<X className="h-5 w-5" />
						</Button>
						<div className="flex flex-col items-center justify-center gap-4 max-w-full max-h-full">
							<img
								src={selectedImage.src}
								alt={selectedImage.name}
								className="max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto object-contain rounded-lg shadow-2xl"
								onClick={(e) => e.stopPropagation()}
								style={{ maxWidth: 'calc(100vw - 4rem)', maxHeight: 'calc(100vh - 8rem)' }}
							/>
							<p className="text-center text-white text-sm sm:text-base font-medium px-4">
								{selectedImage.name}
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
