const DEFAULT_MAX_DIMENSION = 768;
const MIN_DIMENSION = 320;
const DEFAULT_TARGET_KB = 50;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.08;
const SCALE_STEP = 0.9;

function readFileAsDataURL(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => {
			reader.abort();
			reject(new Error('Failed to read image file.'));
		};
		reader.onload = () => resolve((reader.result as string) ?? '');
		reader.readAsDataURL(file);
	});
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Failed to load image.'));
		img.src = src;
	});
}

function ensureCanvasSize(width: number, height: number): { width: number; height: number } {
	const largestSide = Math.max(width, height);
	if (largestSide <= DEFAULT_MAX_DIMENSION) {
		return { width, height };
	}

	const scale = DEFAULT_MAX_DIMENSION / largestSide;
	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
	};
}

export function estimateDataUrlBytes(dataUrl: string): number {
	const base64 = dataUrl.split(',')[1] ?? '';
	const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
	return Math.floor(base64.length * 0.75) - padding;
}

export interface CompressImageOptions {
	targetKilobytes?: number;
	mimeType?: 'image/jpeg' | 'image/webp';
	minQuality?: number;
}

export interface CompressedImage {
	dataUrl: string;
	bytes: number;
	quality: number;
	width: number;
	height: number;
	wasResized: boolean;
}

export async function compressImage(
	file: File,
	options: CompressImageOptions = {}
): Promise<CompressedImage> {
	const targetBytes = Math.max(1, Math.round((options.targetKilobytes ?? DEFAULT_TARGET_KB) * 1024));
	const mimeType = options.mimeType ?? 'image/jpeg';
	const minQuality = options.minQuality ?? MIN_QUALITY;

	const originalDataUrl = await readFileAsDataURL(file);
	const image = await loadImage(originalDataUrl);

	let { width, height } = ensureCanvasSize(image.width, image.height);
	let quality = 0.92;
	let wasResized = width !== image.width || height !== image.height;

	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Canvas context not available for compression.');
	}

	let dataUrl = originalDataUrl;
	let bytes = estimateDataUrlBytes(dataUrl);

	if (bytes <= targetBytes) {
		return {
			dataUrl,
			bytes,
			quality: 1,
			width: image.width,
			height: image.height,
			wasResized: false,
		};
	}

	let iterations = 0;
	const maxIterations = 12;

	while (iterations < maxIterations) {
		iterations += 1;
		canvas.width = Math.max(1, Math.round(width));
		canvas.height = Math.max(1, Math.round(height));

		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(image, 0, 0, canvas.width, canvas.height);

		dataUrl = canvas.toDataURL(mimeType, quality);
		bytes = estimateDataUrlBytes(dataUrl);

		if (bytes <= targetBytes || (quality <= minQuality && (width <= MIN_DIMENSION || height <= MIN_DIMENSION))) {
			break;
		}

		if (quality > minQuality) {
			quality = Math.max(minQuality, quality - QUALITY_STEP);
		} else {
			width = Math.max(MIN_DIMENSION, Math.round(width * SCALE_STEP));
			height = Math.max(MIN_DIMENSION, Math.round(height * SCALE_STEP));
			wasResized = true;
		}
	}

	return {
		dataUrl,
		bytes,
		quality,
		width: canvas.width,
		height: canvas.height,
		wasResized,
	};
}
