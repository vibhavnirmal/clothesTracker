import React from 'react';
import { Pencil } from 'lucide-react';
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
}: ClothesCardProps) {
	const getInitials = (name: string) => {
		return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
	};

	const getColorFromName = (name: string) => {
		const colors = [
			'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
			'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-gray-500'
		];
		const index = name.length % colors.length;
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
		<div
			className={`bg-white relative transition-all cursor-pointer`}
			style={{
				borderRadius: selected ? '0.25rem' : '0',
				backgroundColor: selected ? '#f8f8f8ff' : 'white',
			}}
			role="button"
			tabIndex={0}
			aria-pressed={isChecked}
			onClick={handleCardClick}
			onKeyDown={handleCardKeyDown}
		>
			{onEdit && (
				<button
					type="button"
					onClick={event => {
						event.stopPropagation();
						onEdit();
					}}
					className="absolute bottom-0 right-0 items-center justify-center p-1 text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
					aria-label={`Edit ${item.name}`}
				>
					<Pencil className="h-3.5 w-3.5" />
				</button>
			)}


			{/* Image or initials placeholder */}
			<div className="">
				{item.image ? (
					<ImageWithFallback
						src={item.image}
						alt={item.name}
						className="w-full h-32 object-cover"
						style={{ borderTopLeftRadius: '0.25rem', borderTopRightRadius: '0.25rem' }}
					/>
				) : (
					<div
						className={`w-full h-32 flex items-center justify-center text-white text-2xl ${getColorFromName(item.name)}`}
						style={{ backgroundColor: item.color || undefined }}
					>
						{getInitials(item.name)}
					</div>
				)}
			</div>

			<div style={{ padding: '0.5rem' }}>
				{/* Wear count badge */}
				{item.wearsSinceWash >= 1 && (
					<div className={`relative mt-1 text-gray-500 flex items-center justify-center text-xs`}>
						worn &nbsp;<span className={`${badgeColor} text-white rounded-md`} style={{ fontWeight: 'bold' }}>&nbsp;{item.wearsSinceWash}&nbsp;</span>&nbsp; time{item.wearsSinceWash > 1 ? 's' : ''} since last wash
					</div>
					// <div className={`relative border border-gray-600 ${badgeColor} text-white w-full flex items-center justify-center text-sm font-bold`}>
					//   Wears since wash: {item.wearsSinceWash} 
					// </div>
				)}

				{!item.wearsSinceWash && (
					<div className={`relative mt-1 text-gray-500 w-full flex items-center justify-center text-xs`}>
						No wears since last wash
					</div>
				)}
				{/* Clothes info */}
				<div className="flex justify-between items-center">
					<div className='items-start' style={{ paddingTop: '0.5rem', minWidth: 0 }}>
						<div className='flex flex-row gap-2 items-center'>
							{typeIcon && (
									<img src={getIconPath(typeIcon) || ''} alt="" className="w-4 h-4 flex-shrink-0" />
							)}
							<h3 className="text-sm truncate overflow-hidden whitespace-nowrap w-full">{item.name}</h3>
						
							{/* <p className="text-xs text-gray-600 truncate">{item.type}</p> */}
							{item.size && (
								<>
									<span className="text-xs text-gray-600 font-medium" style={{ paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: "lightblue"}}>{item.size}</span>
								</>
							)}
							{/* {item.madeIn && (
								<>
									<span className="text-xs text-gray-500 italic">{item.madeIn}</span>
								</>
							)} */}
						</div>
					</div>
				</div>
				{/* Wear today checkbox */}
				<div className="flex items-center space-x-2" style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }} data-no-card-toggle>
					<Checkbox
						id={`wear-${item.id}`}
						checked={isChecked}
						onCheckedChange={(value: boolean | 'indeterminate') => {
							if (value === 'indeterminate') {
								return;
							}
							onToggle(Boolean(value));
						}}
					/>
					<label
						htmlFor={`wear-${item.id}`}
						className="select-none text-sm"
						style={{
							backgroundColor: isChecked ? '#ffee00ee' : 'transparent',
							color: isChecked ? 'black' : 'inherit',
							padding: '0.25rem',
							borderRadius: '0.25rem'
						}}>
						{isChecked ? 'Marked for' : 'Wear'} today
					</label>
				</div>
				{/* Last worn info */}
				<div className="mt-1">
					<p className={`text-xs ${wornToday ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
						{wearStatusLabel}
					</p>
				</div>
			</div>
		</div>
	);
}