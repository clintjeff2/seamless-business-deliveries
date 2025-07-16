import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format currency to XAF (Central African Franc)
 * @param amount - The amount to format
 * @param locale - The locale for formatting (defaults to 'fr-CM' for Cameroon)
 * @returns Formatted currency string in XAF
 */
export function formatXAF(amount: number, locale: string = 'fr-CM'): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: 'XAF',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

/**
 * Format XAF with custom formatting for better display
 * @param amount - The amount to format
 * @returns Formatted currency string with XAF suffix
 */
export function formatXAFSimple(amount: number): string {
	return `${amount.toLocaleString('fr-CM')} XAF`;
}

/**
 * Format XAF for compact display (e.g., 1.2K XAF, 1.5M XAF)
 * @param amount - The amount to format
 * @returns Compact formatted currency string
 */
export function formatXAFCompact(amount: number): string {
	const formatter = new Intl.NumberFormat('fr-CM', {
		notation: 'compact',
		compactDisplay: 'short',
		minimumFractionDigits: 0,
		maximumFractionDigits: 1,
	});

	return `${formatter.format(amount)} XAF`;
}

/**
 * Parse XAF string back to number
 * @param xafString - XAF formatted string
 * @returns Parsed number
 */
export function parseXAF(xafString: string): number {
	return parseFloat(xafString.replace(/[^\d.-]/g, '')) || 0;
}

/**
 * Generate a beautiful gradient class name based on index
 * @param index - Index for gradient selection
 * @returns Tailwind gradient class name
 */
export function getGradientClass(index: number): string {
	const gradients = [
		'bg-gradient-to-r from-violet-600 to-indigo-600',
		'bg-gradient-to-r from-cyan-500 to-blue-500',
		'bg-gradient-to-r from-green-400 to-blue-500',
		'bg-gradient-to-r from-purple-400 to-pink-400',
		'bg-gradient-to-r from-yellow-400 to-orange-500',
		'bg-gradient-to-r from-red-400 to-pink-500',
		'bg-gradient-to-r from-indigo-400 to-cyan-400',
		'bg-gradient-to-r from-emerald-400 to-cyan-400',
	];

	return gradients[index % gradients.length];
}

/**
 * Generate beautiful avatar gradient based on name
 * @param name - Name to generate gradient for
 * @returns Tailwind gradient class name
 */
export function getAvatarGradient(name: string): string {
	const hash = name
		.split('')
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return getGradientClass(hash);
}

/**
 * Delay function for smooth animations
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random beautiful color for charts/UI elements
 * @returns HSL color string
 */
export function generateBeautifulColor(): string {
	const hue = Math.floor(Math.random() * 360);
	const saturation = Math.floor(Math.random() * 30) + 60; // 60-90%
	const lightness = Math.floor(Math.random() * 20) + 40; // 40-60%

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
