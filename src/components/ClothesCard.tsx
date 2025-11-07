import React from 'react';
import { Pencil, ShoppingBag, Circle, Check } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { ImageWithFallback } from './ImageWithFallback';
import type { ClothesItem } from '../types';
import { getColorName } from '../lib/colors';
import { formatIsoDate } from '../lib/date';
import { getIconPath } from '../lib/icons';

interface ClothesCardProps {
	item: ClothesItem;
	selected: boolean;
	onToggle: (nextChecked: boolean) => void;
	badgeColor: string;
	wornToday: boolean;
	lastWearDate?: string;
	onEdit?: () => void;
	typeIcon?: string | null;
	onToggleLaundryBag?: (inBag: boolean) => void;
}

export function ClothesCard({
	item,
	selected,
	onToggle,
	badgeColor,
	wornToday,
	lastWearDate,
	onEdit,
	typeIcon,
	onToggleLaundryBag,
}: ClothesCardProps) {
	const getInitials = (name: string) => {
		if (!name) return '';
		return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
	};

	const getColorFromName = (name: string) => {
		const colors = [
			'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
			'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-gray-500'
		];
		const index = (name?.length || 0) % colors.length;
		return colors[index];
	};

	const formatWearDate = (date: string) =>
		formatIsoDate(date, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});

	const isChecked = selected || wornToday;

	const wearStatusLabel = wornToday
		? 'Worn today'
		: lastWearDate
			? `Last worn: ${formatWearDate(lastWearDate)}`
			: 'Never worn yet';

	const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement | null;
		if (target && target.closest('[data-no-card-toggle]')) {
			return;
		}
		onToggle(!isChecked);
	};

	const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onToggle(!isChecked);
		}
	};

	return (
		<div className={`bg-white relative overflow-hidden`}
			style={{ ...item.inLaundryBag ? { opacity: 0.8 } : {} }}>
			{/* Image Section - Instagram style */}
			<div 
				className={`relative w-full overflow-hidden ${!item.inLaundryBag ? 'cursor-pointer' : 'cursor-not-allowed'}`}
				style={{ height: '200px' }}
				onClick={!item.inLaundryBag ? handleCardClick : undefined}
				role="button"
				tabIndex={item.inLaundryBag ? -1 : 0}
				aria-pressed={isChecked}
				aria-disabled={item.inLaundryBag}
				onKeyDown={!item.inLaundryBag ? handleCardKeyDown : undefined}
			>
				{/* Laundry bag badge - top left */}
				{item.inLaundryBag && (
					<div className="absolute top-2 left-2 z-10 p-2 rounded-sm shadow-md" style={{ backgroundColor: "white", padding: "2px", color: "black"}}>
						<ShoppingBag className="h-5 w-5" />
					</div>
				)}

				{/* Wear count badge - top right */}
				{item.wearsSinceWash > 0 && (
					<div className={`absolute top-2 right-2 z-10 ${badgeColor} text-white px-3 py-1 shadow-md rounded-sm font-sm`}>
						{item.wearsSinceWash} wear{item.wearsSinceWash === 1 ? '' : 's'}
					</div>
				)}

				{/* Selected checkmark - center overlay when selected */}
				{isChecked && (
					<div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-10">
						<div className="rounded-full p-3" style={{ backgroundColor:"yellow"}}>
							<svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
							</svg>
						</div>
					</div>
				)}

				{/* Main image */}
				{item.image ? (
					<ImageWithFallback
						src={item.image}
						alt={item.name}
						className="w-full h-full object-cover"
						style={{ width: '100%', height: '200px', objectFit: 'cover' }}
					/>
				) : (
					<div
						className={`w-full h-full flex items-center justify-center text-white text-4xl font-bold ${getColorFromName(item.name)}`}
						style={{ backgroundColor: item.color || undefined, width: '100%', height: '200px' }}
					>
						{getInitials(item.name)}
					</div>
				)}
			</div>

			{/* Content Section - Instagram post style */}
			<div className="p-3" data-no-card-toggle>
				{/* Action buttons row */}
			<div className="flex justify-start">
				{/* Wear today button */}
				<button
					onClick={() => onToggle(!isChecked)}
					disabled={item.inLaundryBag || wornToday}
					className={`flex-1 flex gap-2 py-2 px-3 font-medium text-sm transition-all`}
					style={{ 
						...(item.inLaundryBag || wornToday) ? { 
							backgroundColor: '#E5E7EB', 
							color: '#9CA3AF', 
							cursor: 'not-allowed' 
						} : isChecked ? { 
							backgroundColor: '#FBBF24', 
							color: 'black' 
						} : {} 
					}}
				>
					<div className={`w-5 h-5 flex items-center justify-center`}
						style={{ ...isChecked ? {border: "1px solid black"} : {border: "1px solid #D1D5DB"}}}
					>
						{isChecked && <Check className="h-3 w-3 text-yellow-400" strokeWidth={3} />}
					</div>
					{wornToday ? 'Worn Today' : isChecked ? 'Wearing' : 'Wear'}
				</button>					{/* Laundry bag button */}
					{onToggleLaundryBag && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggleLaundryBag(!item.inLaundryBag);
							}}
							className={`flex items-center justify-center px-2 py-2 transition-all ${
								item.inLaundryBag 
									? 'bg-blue-500 text-white hover:bg-blue-600' 
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
							}`}
							title={item.inLaundryBag ? 'In laundry bag' : 'Add to laundry bag'}
						>
							<ShoppingBag className="h-5 w-5" />
						</button>
					)}
				</div>
				{/* Header row with name and type icon */}
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2 min-w-0 flex-1">
						{typeIcon && (
							<img src={getIconPath(typeIcon) || ''} alt="" className="w-5 h-5 flex-shrink-0" />
						)}
						<h3 className="font-semibold text-base truncate">{item.name}</h3>
						{item.size && (
							<span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full flex-shrink-0">
								{item.size}
							</span>
						)}
						{item.color && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                )}
					</div>
					{onEdit && !item.inLaundryBag && (
						<button
							type="button"
							onClick={event => {
								event.stopPropagation();
								onEdit();
							}}
							className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
							aria-label={`Edit ${item.name}`}
						>
							<Pencil className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Status indicator */}
				<div className="flex items-center gap-2 mb-3 text-xs">
					<span className={wornToday ? 'text-green-600 font-medium' : 'text-gray-500'}>
						{wornToday ? 'Worn today' : lastWearDate ? formatWearDate(lastWearDate) : 'Never worn'}
					</span>
				</div>

				
			</div>
		</div>
	);
}