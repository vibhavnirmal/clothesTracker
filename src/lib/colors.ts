export const COLOR_OPTIONS = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Navy', value: '#000080' },
  { name: 'Light Blue', value: '#ADD8E6' },
  { name: 'Gray', value: '#808080' },
  { name: 'Charcoal', value: '#36454F' },
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Maroon', value: '#800000' },
  { name: 'Pink', value: '#FFC0CB' },
  { name: 'Purple', value: '#800080' },
  { name: 'Lavender', value: '#E6E6FA' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Gold', value: '#FFD700' },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Brown', value: '#A52A2A' },
  { name: 'Beige', value: '#F5F5DC' },
  { name: 'Khaki', value: '#F0E68C' },
  { name: 'Olive', value: '#808000' },
  { name: 'Green', value: '#008000' },
  { name: 'Mint', value: '#98FF98' },
  { name: 'Lime', value: '#00FF00' },
  { name: 'Teal', value: '#008080' },
  { name: 'Cyan', value: '#00FFFF' },
  { name: 'Turquoise', value: '#40E0D0' },
  { name: 'Cream', value: '#FFFDD0' },
  { name: 'Ivory', value: '#FFFFF0' },
  { name: 'Coral', value: '#FF7F50' },
  { name: 'Burgundy', value: '#800020' },
  { name: 'Mustard', value: '#FFDB58' },
  { name: 'Peach', value: '#FFDAB9' },
  { name: 'Tan', value: '#D2B48C' },
  { name: 'Magenta', value: '#FF00FF' },
  { name: 'Sky Blue', value: '#87CEEB' },
  { name: 'Denim', value: '#1560BD' },
];

const colorNameByValue = new Map(
  COLOR_OPTIONS.map(({ name, value }) => [value.toUpperCase(), name])
);

export function getColorName(value?: string | null): string {
  if (!value) {
    return 'No color set';
  }

  const normalized = value.toUpperCase();
  const knownName = colorNameByValue.get(normalized);

  if (knownName) {
    return knownName;
  }

  return `Custom (${normalized})`;
}
