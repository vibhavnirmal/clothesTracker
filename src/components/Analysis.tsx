import { useMemo, useState } from 'react';
import { Activity, Shirt } from 'lucide-react';
import type { ClothesItem, WearRecord, WashRecord } from '../types';
import { getColorName } from '../lib/colors';

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
	const { totals, perItemSummaries, topWorn, topWashed } = useMemo(() => {
		const wearCountMap = new Map<string, number>();
		const washCountMap = new Map<string, number>();

		wearRecords.forEach(record => {
			wearCountMap.set(record.clothesId, (wearCountMap.get(record.clothesId) ?? 0) + 1);
		});

		washRecords.forEach(record => {
			washCountMap.set(record.clothesId, (washCountMap.get(record.clothesId) ?? 0) + 1);
		});

		const perItemSummaries: ItemSummary[] = clothes.map(item => {
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

		return {
			totals: {
				uniqueItems: clothes.length,
				totalWearEntries: wearRecords.length,
				totalWashEntries: washRecords.length,
				neverWashedCount: perItemSummaries.filter(summary => summary.totalWashCount === 0).length,
				neverWornCount: perItemSummaries.filter(summary => summary.totalWearCount === 0).length,
			},
			perItemSummaries,
			topWorn: topWornItems,
			topWashed: topWashedItems,
		};
	}, [clothes, wearRecords, washRecords]);

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
		<div className="pb-24">
			<div className="p-4 space-y-6">
				<header className="flex items-center gap-3 mb-6">
					<h1 className="flex items-center gap-2">
						<Activity className="w-5 h-5 text-blue-500" />
						Analysis
						{/* <p className="text-xs text-gray-500">Lifetime wear and wash insights gathered from your activity.</p> */}
					</h1>
				</header>

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
										<p className="text-sm font-medium text-gray-900">{item.name}</p>
										<p className="text-xs text-gray-500">
											{item.type} • {totalWearCount} wear{totalWearCount !== 1 ? 's' : ''}
										</p>
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
		</div>
	);
}
