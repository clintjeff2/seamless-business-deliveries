const MAPBOX_API_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface GeocodingResult {
	latitude: number;
	longitude: number;
	formattedAddress?: string;
	confidence?: number;
}

/**
 * Enhanced geocoding function optimized for Cameroon and African addresses
 * @param address - The address to geocode
 * @param options - Additional options for geocoding
 * @returns Promise<GeocodingResult | null>
 */
export async function geocodeAddress(
	address: string,
	options: {
		country?: string;
		proximity?: [number, number]; // [longitude, latitude]
		types?: string[];
	} = {}
): Promise<GeocodingResult | null> {
	if (!MAPBOX_ACCESS_TOKEN) {
		console.error('Mapbox access token is not configured');
		return null;
	}

	try {
		// Enhanced address preprocessing for Cameroon
		const enhancedAddress = preprocessCameroonAddress(address);
		console.log(enhancedAddress, 'jeff 1');

		// Set default options for Cameroon
		const {
			country = 'CM', // Cameroon country code
			proximity = [11.5174, 3.848], // Cameroon center coordinates [lng, lat]
			types = ['place', 'district', 'locality', 'neighborhood', 'address'],
		} = options;

		// Build query parameters
		const params = new URLSearchParams({
			access_token: MAPBOX_ACCESS_TOKEN,
			limit: '5', // Get multiple results for better matching
			country: country,
			proximity: proximity.join(','),
			types: types.join(','),
			language: 'en', // Use English for better results
		});

		console.log(params, 'jeff 2');

		// Try multiple geocoding strategies
		const strategies = [
			enhancedAddress, // Original enhanced address
			`${enhancedAddress}, Cameroon`, // Add country
			`${enhancedAddress}, Southwest Region, Cameroon`, // Add region
			address, // Fallback to original
		];

		for (const searchAddress of strategies) {
			const encodedAddress = encodeURIComponent(searchAddress);
			const url = `${MAPBOX_API_BASE}/${encodedAddress}.json?${params}`;

			console.log(`Trying to geocode: "${searchAddress}"`);

			const response = await fetch(url);

			if (!response.ok) {
				console.warn(
					`Geocoding request failed for "${searchAddress}": ${response.status}`
				);
				continue;
			}

			const data = await response.json();

			// Check if we got any results
			if (data.features && data.features.length > 0) {
				// Find the best match
				const bestMatch = findBestMatch(data.features, searchAddress);

				if (bestMatch) {
					const [longitude, latitude] = bestMatch.center;

					return {
						latitude,
						longitude,
						formattedAddress: bestMatch.place_name,
						confidence: calculateConfidence(bestMatch, searchAddress),
					};
				}
			}
		}

		// If all strategies fail, try with relaxed parameters for major cities
		return await tryMajorCityFallback(address);
	} catch (error) {
		console.error('Geocoding error:', error);
		return null;
	}
}

/**
 * Preprocess address to work better with Cameroon locations
 */
function preprocessCameroonAddress(address: string): string {
	// Common Cameroon address patterns and improvements
	let processed = address.trim();

	// Standardize common location names in Cameroon
	const locationMappings: Record<string, string> = {
		'mile 17': 'Mile 17 Motor Park',
		mile17: 'Mile 17 Motor Park',
		buea: 'Buea, Southwest Region',
		douala: 'Douala, Littoral Region',
		yaounde: 'Yaoundé, Centre Region',
		bamenda: 'Bamenda, Northwest Region',
		limbe: 'Limbe, Southwest Region',
		bafoussam: 'Bafoussam, West Region',
		garoua: 'Garoua, North Region',
		maroua: 'Maroua, Far North Region',
		ngaoundere: 'Ngaoundéré, Adamawa Region',
		bertoua: 'Bertoua, East Region',
		ebolowa: 'Ebolowa, South Region',
	};

	// Apply mappings
	const lowerAddress = processed.toLowerCase();
	for (const [key, value] of Object.entries(locationMappings)) {
		if (lowerAddress.includes(key)) {
			processed = processed.replace(new RegExp(key, 'gi'), value);
			break;
		}
	}

	// Add common Cameroon context if missing
	if (
		!processed.toLowerCase().includes('cameroon') &&
		!processed.toLowerCase().includes('region')
	) {
		// Try to detect region from common indicators
		if (
			processed.toLowerCase().includes('buea') ||
			processed.toLowerCase().includes('limbe') ||
			processed.toLowerCase().includes('mile')
		) {
			processed += ', Southwest Region';
		}
	}

	return processed;
}

/**
 * Find the best matching result from geocoding response
 */
function findBestMatch(features: any[], originalAddress: string) {
	if (features.length === 0) return null;

	// Score each feature based on relevance
	const scoredFeatures = features.map((feature) => {
		let score = 0;
		const placeName = feature.place_name.toLowerCase();
		const originalLower = originalAddress.toLowerCase();

		// Higher score for exact matches
		if (placeName.includes(originalLower)) score += 100;

		// Score based on place type hierarchy
		if (feature.properties?.accuracy === 'point') score += 50;
		if (feature.place_type?.includes('address')) score += 40;
		if (feature.place_type?.includes('poi')) score += 30;
		if (feature.place_type?.includes('place')) score += 20;

		// Prefer results in Cameroon
		if (placeName.includes('cameroon')) score += 25;

		// Prefer results with higher relevance
		score += (feature.relevance || 0) * 10;

		return { feature, score };
	});

	// Sort by score and return the best match
	scoredFeatures.sort((a, b) => b.score - a.score);
	return scoredFeatures[0].feature;
}

/**
 * Calculate confidence score for the geocoding result
 */
function calculateConfidence(feature: any, originalAddress: string): number {
	let confidence = feature.relevance || 0.5;

	// Boost confidence for exact matches
	if (
		feature.place_name.toLowerCase().includes(originalAddress.toLowerCase())
	) {
		confidence = Math.min(confidence + 0.3, 1.0);
	}

	// Boost confidence for point accuracy
	if (feature.properties?.accuracy === 'point') {
		confidence = Math.min(confidence + 0.2, 1.0);
	}

	return Math.round(confidence * 100) / 100;
}

/**
 * Fallback to major Cameroon cities if geocoding fails
 */
async function tryMajorCityFallback(
	address: string
): Promise<GeocodingResult | null> {
	const majorCities: Record<string, [number, number]> = {
		buea: [9.2385, 4.1556],
		douala: [9.7043, 4.0483],
		yaounde: [11.5021, 3.848],
		bamenda: [10.1591, 5.9631],
		limbe: [9.2106, 4.0226],
		'mile 17': [9.2589, 4.1621], // Mile 17 Motor Park coordinates
	};

	const lowerAddress = address.toLowerCase();

	for (const [city, coords] of Object.entries(majorCities)) {
		if (lowerAddress.includes(city)) {
			console.log(`Using fallback coordinates for ${city}`);
			return {
				latitude: coords[1],
				longitude: coords[0],
				formattedAddress: `${city}, Cameroon (approximate)`,
				confidence: 0.7,
			};
		}
	}

	return null;
}

/**
 * Reverse geocoding - convert coordinates to address
 */
export async function reverseGeocode(
	latitude: number,
	longitude: number
): Promise<string | null> {
	if (!MAPBOX_ACCESS_TOKEN) {
		console.error('Mapbox access token is not configured');
		return null;
	}

	try {
		const response = await fetch(
			`${MAPBOX_API_BASE}/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi,place`
		);

		if (!response.ok) {
			throw new Error('Reverse geocoding request failed');
		}

		const data = await response.json();

		if (data.features && data.features.length > 0) {
			return data.features[0].place_name;
		}

		return null;
	} catch (error) {
		console.error('Reverse geocoding error:', error);
		return null;
	}
}

/**
 * Test geocoding function with sample addresses
 */
export async function testGeocoding() {
	const testAddresses = [
		'Mile 17 Motor Park, Buea',
		'Mile 17, Buea, Southwest Region',
		'Buea, Southwest Region, Cameroon',
		'University of Buea, Buea',
		'Douala International Airport',
		'Yaoundé Central Market',
	];

	console.log('Testing geocoding with sample addresses...');

	for (const address of testAddresses) {
		try {
			const result = await geocodeAddress(address);
			if (result) {
				console.log(`✓ ${address}:`, {
					lat: result.latitude,
					lng: result.longitude,
					formatted: result.formattedAddress,
					confidence: result.confidence,
				});
			} else {
				console.log(`✗ Failed to geocode: ${address}`);
			}
		} catch (error) {
			console.error(`✗ Error geocoding "${address}":`, error);
		}
	}
}
