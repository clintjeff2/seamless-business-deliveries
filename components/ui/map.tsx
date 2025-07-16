'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import {
	Moon,
	Sun,
	Navigation,
	Clock,
	MapPin,
	Truck,
	AlertTriangle,
} from 'lucide-react';

// Initialize Mapbox with access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface RouteInfo {
	distance: number;
	duration: number;
	durationInTraffic: number;
	geometry: any;
	steps: any[];
}

interface MapProps {
	center: [number, number];
	zoom?: number;
	markers?: Array<{
		position: [number, number];
		title?: string;
		color?: string;
	}>;
	className?: string;
	showLiveLocation?: boolean;
	destination?: [number, number];
	onRouteUpdate?: (routeInfo: RouteInfo) => void;
	driverLocation?: [number, number] | null; // Current driver position from database
}

export function Map({
	center,
	zoom = 13,
	markers = [],
	className = '',
	showLiveLocation = false,
	destination,
	onRouteUpdate,
	driverLocation,
}: MapProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<mapboxgl.Marker[]>([]);
	const locationMarkerRef = useRef<mapboxgl.Marker | null>(null);
	const watchIdRef = useRef<number | null>(null);
	const routeLayerRef = useRef<string | null>(null);
	const [mapLoaded, setMapLoaded] = useState(false);
	const [styleLoaded, setStyleLoaded] = useState(false);
	const routeRequestRef = useRef<{
		start: [number, number];
		end: [number, number];
	} | null>(null);
	const lastRouteRef = useRef<string>('');

	const [userLocation, setUserLocation] = useState<[number, number] | null>(
		null
	);
	const [isDarkMode, setIsDarkMode] = useState(false);
	const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [trafficLevel, setTrafficLevel] = useState<
		'low' | 'moderate' | 'heavy'
	>('moderate');

	// Auto dark mode based on time
	useEffect(() => {
		const hour = new Date().getHours();
		setIsDarkMode(hour < 6 || hour >= 19);
	}, []);

	// Stable reference for route fetching
	const fetchRoute = useCallback(
		async (start: [number, number], end: [number, number]) => {
			if (!start || !end) return;

			const map = mapInstanceRef.current;
			if (!map || !map.isStyleLoaded()) return;

			// Create a unique key for this route request
			const routeKey = `${start[0]},${start[1]}-${end[0]},${end[1]}`;

			// Skip if we already have this route
			if (lastRouteRef.current === routeKey) return;

			setIsLoading(true);
			try {
				const response = await fetch(
					`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
				);

				const data = await response.json();

				if (data.routes && data.routes.length > 0) {
					const route = data.routes[0];
					const routeData: RouteInfo = {
						distance: route.distance,
						duration: route.duration,
						durationInTraffic: route.duration_typical || route.duration,
						geometry: route.geometry,
						steps: route.legs[0]?.steps || [],
					};

					setRouteInfo(routeData);
					onRouteUpdate?.(routeData);
					lastRouteRef.current = routeKey;

					// Determine traffic level
					const trafficFactor =
						routeData.durationInTraffic / routeData.duration;
					if (trafficFactor > 1.5) setTrafficLevel('heavy');
					else if (trafficFactor > 1.2) setTrafficLevel('moderate');
					else setTrafficLevel('low');

					// Add route to map
					if (map && map.isStyleLoaded()) {
						// Remove existing route
						if (routeLayerRef.current) {
							try {
								if (map.getLayer(routeLayerRef.current)) {
									map.removeLayer(routeLayerRef.current);
								}
								if (map.getSource(routeLayerRef.current)) {
									map.removeSource(routeLayerRef.current);
								}
							} catch (error) {
								console.warn('Error removing route layer:', error);
							}
						}

						const routeId = 'route-' + Date.now();
						routeLayerRef.current = routeId;

						map.addSource(routeId, {
							type: 'geojson',
							data: {
								type: 'Feature',
								properties: {},
								geometry: route.geometry,
							},
						});

						map.addLayer({
							id: routeId,
							type: 'line',
							source: routeId,
							layout: {
								'line-join': 'round',
								'line-cap': 'round',
							},
							paint: {
								'line-color':
									trafficLevel === 'heavy'
										? '#ff4444'
										: trafficLevel === 'moderate'
										? '#ff8800'
										: '#00aa00',
								'line-width': 5,
								'line-opacity': 0.8,
							},
						});

						// Only fit bounds if this is the first route
						if (!routeInfo) {
							const bounds = new mapboxgl.LngLatBounds();
							bounds.extend(start);
							bounds.extend(end);
							map.fitBounds(bounds, { padding: 50 });
						}
					}
				}
			} catch (error) {
				console.error('Error fetching route:', error);
			} finally {
				setIsLoading(false);
			}
		},
		[onRouteUpdate, routeInfo, trafficLevel]
	);

	// Initialize map only once
	useEffect(() => {
		if (!mapRef.current || mapInstanceRef.current) return;

		const map = new mapboxgl.Map({
			container: mapRef.current,
			style: isDarkMode
				? 'mapbox://styles/mapbox/dark-v11'
				: 'mapbox://styles/mapbox/streets-v12',
			center: center,
			zoom: zoom,
		});

		// Add navigation controls
		map.addControl(new mapboxgl.NavigationControl(), 'top-right');

		// Handle map load events
		map.on('load', () => {
			setMapLoaded(true);
			setStyleLoaded(true);

			// Add traffic layer
			try {
				map.addSource('mapbox-traffic', {
					type: 'vector',
					url: 'mapbox://mapbox.mapbox-traffic-v1',
				});

				map.addLayer({
					id: 'traffic-layer',
					type: 'line',
					source: 'mapbox-traffic',
					'source-layer': 'traffic',
					layout: {
						'line-join': 'round',
						'line-cap': 'round',
					},
					paint: {
						'line-color': [
							'case',
							['==', ['get', 'congestion'], 'low'],
							'#00ff00',
							['==', ['get', 'congestion'], 'moderate'],
							'#ffff00',
							['==', ['get', 'congestion'], 'heavy'],
							'#ff6600',
							['==', ['get', 'congestion'], 'severe'],
							'#ff0000',
							'#888888',
						],
						'line-width': 3,
						'line-opacity': 0.8,
					},
				});
			} catch (error) {
				console.warn('Error adding traffic layer:', error);
			}
		});

		// Handle style changes
		map.on('styledata', () => {
			if (map.isStyleLoaded()) {
				setStyleLoaded(true);
			}
		});

		mapInstanceRef.current = map;

		return () => {
			if (mapInstanceRef.current) {
				mapInstanceRef.current.remove();
				mapInstanceRef.current = null;
			}
			setMapLoaded(false);
			setStyleLoaded(false);
		};
	}, []);

	// Handle style changes separately to avoid recreation
	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map) return;

		setStyleLoaded(false);
		map.setStyle(
			isDarkMode
				? 'mapbox://styles/mapbox/dark-v11'
				: 'mapbox://styles/mapbox/streets-v12'
		);
	}, [isDarkMode]);

	// Handle markers updates
	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !mapLoaded) return;

		// Clear existing markers
		markersRef.current.forEach((marker) => marker.remove());
		markersRef.current = [];

		console.log('Creating markers:', markers); // Debug log

		// Add new markers with precise positioning
		markers.forEach(({ position, title, color = '#FF0000' }) => {
			// Ensure coordinates are numbers with proper precision
			const lng = Number(position[0]);
			const lat = Number(position[1]);

			console.log('Processing marker:', { title, position, lng, lat }); // Debug log

			// Validate coordinates more strictly
			if (isNaN(lng) || isNaN(lat)) {
				console.error('NaN coordinates detected:', {
					title,
					position,
					lng,
					lat,
				});
				return;
			}

			if (lng < -180 || lng > 180) {
				console.error('Invalid longitude (must be -180 to 180):', {
					title,
					lng,
				});
				return;
			}

			if (lat < -90 || lat > 90) {
				console.error('Invalid latitude (must be -90 to 90):', { title, lat });
				return;
			}

			// Check for default/fallback coordinates that might be wrong
			if (lng === 0 && lat === 0) {
				console.warn('Coordinates are [0,0] - this might be incorrect:', {
					title,
				});
				return;
			}

			const precisePosition: [number, number] = [lng, lat];
			console.log('Creating marker at precise position:', {
				title,
				precisePosition,
			}); // Debug log

			// Create marker element with enhanced visibility
			const element = document.createElement('div');
			element.className = 'custom-marker';
			element.style.zIndex = '1000'; // Ensure marker is on top

			// Different styling for delivery destination vs driver location
			if (title?.includes('Delivery')) {
				// Enhanced delivery destination marker - red pin with better visibility
				element.innerHTML = `
					<div class="delivery-marker" style="position: relative; width: 40px; height: 40px; z-index: 1000;">
						<div class="marker-pin" style="
							width: 40px;
							height: 40px;
							background: #ef4444;
							border: 4px solid white;
							border-radius: 50% 50% 50% 0;
							transform: rotate(-45deg);
							box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
							position: relative;
							z-index: 1001;
						"></div>
						<div class="marker-pin-inner" style="
							content: '';
							position: absolute;
							top: 50%;
							left: 50%;
							width: 16px;
							height: 16px;
							background: white;
							border-radius: 50%;
							transform: translate(-50%, -50%) rotate(45deg);
							z-index: 1002;
						"></div>
						<div class="marker-pulse" style="
							position: absolute;
							top: 0;
							left: 0;
							width: 40px;
							height: 40px;
							background: rgba(239, 68, 68, 0.4);
							border-radius: 50% 50% 50% 0;
							transform: rotate(-45deg);
							animation: marker-pulse 2s infinite;
							z-index: 999;
						"></div>
					</div>
				`;
			} else {
				// Driver location marker - blue circle
				element.innerHTML = `
					<div class="driver-marker" style="position: relative; width: 28px; height: 28px; z-index: 1000;">
						<div class="marker-circle" style="
							width: 28px;
							height: 28px;
							background: #3b82f6;
							border: 4px solid white;
							border-radius: 50%;
							box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
							position: relative;
							z-index: 1001;
						"></div>
						<div class="marker-ring" style="
							position: absolute;
							top: 0;
							left: 0;
							width: 28px;
							height: 28px;
							background: rgba(59, 130, 246, 0.3);
							border-radius: 50%;
							animation: ring-pulse 2s infinite;
							z-index: 999;
						"></div>
					</div>
				`;
			}

			// Create marker with proper anchor and ensure visibility
			const marker = new mapboxgl.Marker({
				element,
				anchor: title?.includes('Delivery') ? 'bottom' : 'center',
				offset: [0, 0],
			}).setLngLat(precisePosition);

			console.log('Adding marker to map:', {
				title,
				precisePosition,
				anchor: title?.includes('Delivery') ? 'bottom' : 'center',
				elementHTML: element.innerHTML.substring(0, 100) + '...',
			}); // Debug log

			// Add marker to map with error handling
			try {
				marker.addTo(map);
				console.log('✅ Marker successfully added to map:', title);
			} catch (error) {
				console.error('❌ Failed to add marker to map:', title, error);
				return; // Skip this marker if it fails
			}

			// Add popup with better styling
			if (title) {
				const popup = new mapboxgl.Popup({
					offset: title?.includes('Delivery') ? [0, -50] : [0, -15],
					closeButton: true,
					closeOnClick: true,
					className: 'marker-popup',
				}).setHTML(
					`<div style="padding: 12px; font-family: system-ui; text-align: center; min-width: 200px;">
						<div style="font-size: 14px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">
							${title}
						</div>
						<div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
							<strong>Coordinates:</strong><br/>
							Lat: ${lat.toFixed(6)}<br/>
							Lng: ${lng.toFixed(6)}
						</div>
						${
							title?.includes('Delivery')
								? '<div style="font-size: 11px; color: #ef4444; margin-top: 4px; font-weight: 500;">📍 Delivery Destination</div>'
								: '<div style="font-size: 11px; color: #3b82f6; margin-top: 4px; font-weight: 500;">🚗 Driver Location</div>'
						}
					</div>`
				);
				marker.setPopup(popup);
			}

			markersRef.current.push(marker);
		});

		console.log(
			'✅ Total markers created and added:',
			markersRef.current.length
		);

		// Force a map repaint to ensure markers are visible
		if (markersRef.current.length > 0) {
			map.triggerRepaint();
		}
	}, [markers, mapLoaded]);

	// Handle location tracking - prefer database location over device location
	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map) return;

		// Use driver location from database if available
		if (driverLocation) {
			setUserLocation(driverLocation);

			// Update driver location marker
			if (!locationMarkerRef.current) {
				const element = document.createElement('div');
				element.className = 'location-marker';
				element.innerHTML = `
					<div class="relative">
						<div class="w-8 h-8 bg-blue-500 rounded-full border-3 border-white shadow-lg"></div>
						<div class="absolute top-0 left-0 w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-75"></div>
					</div>
				`;
				locationMarkerRef.current = new mapboxgl.Marker({ element })
					.setLngLat(driverLocation)
					.addTo(map);
			} else {
				locationMarkerRef.current.setLngLat(driverLocation);
			}

			// Update route if destination is set
			if (destination) {
				fetchRoute(driverLocation, destination);
			}
		} else if (showLiveLocation) {
			// Fall back to device location only if no database location
			const handlePositionUpdate = (position: GeolocationPosition) => {
				const { latitude, longitude } = position.coords;
				const newLocation: [number, number] = [longitude, latitude];
				setUserLocation(newLocation);

				if (!locationMarkerRef.current) {
					const element = document.createElement('div');
					element.className = 'location-marker';
					element.innerHTML = `
						<div class="relative">
							<div class="w-8 h-8 bg-blue-500 rounded-full border-3 border-white shadow-lg"></div>
							<div class="absolute top-0 left-0 w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-75"></div>
						</div>
					`;
					locationMarkerRef.current = new mapboxgl.Marker({ element })
						.setLngLat(newLocation)
						.addTo(map);
				} else {
					locationMarkerRef.current.setLngLat(newLocation);
				}

				// Update route if destination is set
				if (destination) {
					fetchRoute(newLocation, destination);
				}
			};

			if (navigator.geolocation) {
				watchIdRef.current = navigator.geolocation.watchPosition(
					handlePositionUpdate,
					(error) => console.error('Error getting location:', error),
					{ enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
				);
			}
		}

		return () => {
			if (watchIdRef.current !== null) {
				navigator.geolocation.clearWatch(watchIdRef.current);
				watchIdRef.current = null;
			}
		};
	}, [showLiveLocation, destination, driverLocation, fetchRoute]);

	// Clean up location marker when component unmounts
	useEffect(() => {
		return () => {
			if (locationMarkerRef.current) {
				locationMarkerRef.current.remove();
				locationMarkerRef.current = null;
			}
		};
	}, []);

	// Format time duration
	const formatDuration = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	};

	// Format distance
	const formatDistance = (meters: number): string => {
		if (meters >= 1000) {
			return `${(meters / 1000).toFixed(1)} km`;
		}
		return `${Math.round(meters)} m`;
	};

	return (
		<div className={`relative w-full h-full ${className}`}>
			{/* Map Container */}
			<div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />

			{/* Map Legend/Key */}
			<div className="absolute top-4 right-4 space-y-2">
				<div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-lg shadow-lg">
					<h3 className="text-sm font-semibold mb-2 dark:text-white">
						Map Legend
					</h3>
					<div className="space-y-2">
						<div className="flex items-center space-x-2">
							<div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div>
							<span className="text-xs text-gray-700 dark:text-gray-300">
								Driver Location
							</span>
						</div>
						<div className="flex items-center space-x-2">
							<div
								className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm transform rotate-45"
								style={{ borderRadius: '50% 50% 50% 0' }}
							></div>
							<span className="text-xs text-gray-700 dark:text-gray-300">
								Delivery Destination
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Controls Overlay */}
			<div className="absolute top-4 left-4 space-y-2">
				{/* Dark Mode Toggle */}
				<button
					onClick={() => setIsDarkMode(!isDarkMode)}
					className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
				>
					{isDarkMode ? (
						<Sun className="h-5 w-5 text-yellow-600" />
					) : (
						<Moon className="h-5 w-5 text-gray-600" />
					)}
				</button>

				{/* Traffic Level Indicator */}
				<div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
					<div className="flex items-center space-x-2">
						<AlertTriangle
							className={`h-4 w-4 ${
								trafficLevel === 'heavy'
									? 'text-red-500'
									: trafficLevel === 'moderate'
									? 'text-yellow-500'
									: 'text-green-500'
							}`}
						/>
						<span className="text-sm font-medium capitalize dark:text-white">
							{trafficLevel} Traffic
						</span>
					</div>
				</div>

				{/* Map Status Indicator */}
				{!styleLoaded && (
					<div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
						<div className="flex items-center space-x-2">
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
							<span className="text-sm font-medium dark:text-white">
								Loading Map...
							</span>
						</div>
					</div>
				)}
			</div>

			{/* Route Info Panel */}
			{routeInfo && (
				<div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-4">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="flex items-center space-x-2">
							<MapPin className="h-5 w-5 text-blue-500" />
							<div>
								<p className="text-sm font-medium dark:text-white">Distance</p>
								<p className="text-lg font-bold text-blue-600 dark:text-blue-400">
									{formatDistance(routeInfo.distance)}
								</p>
							</div>
						</div>

						<div className="flex items-center space-x-2">
							<Clock className="h-5 w-5 text-green-500" />
							<div>
								<p className="text-sm font-medium dark:text-white">ETA</p>
								<p className="text-lg font-bold text-green-600 dark:text-green-400">
									{formatDuration(routeInfo.durationInTraffic)}
								</p>
							</div>
						</div>

						<div className="flex items-center space-x-2">
							<Truck className="h-5 w-5 text-orange-500" />
							<div>
								<p className="text-sm font-medium dark:text-white">
									With Traffic
								</p>
								<p className="text-lg font-bold text-orange-600 dark:text-orange-400">
									+
									{formatDuration(
										routeInfo.durationInTraffic - routeInfo.duration
									)}
								</p>
							</div>
						</div>

						<div className="flex items-center space-x-2">
							<Navigation className="h-5 w-5 text-purple-500" />
							<div>
								<p className="text-sm font-medium dark:text-white">Route</p>
								<p className="text-lg font-bold text-purple-600 dark:text-purple-400">
									Optimal
								</p>
							</div>
						</div>
					</div>

					{/* Progress Bar */}
					<div className="mt-4">
						<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
							<span>Current Location</span>
							<span>Destination</span>
						</div>
						<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
							<div
								className={`h-2 rounded-full transition-all duration-500 ${
									trafficLevel === 'heavy'
										? 'bg-red-500'
										: trafficLevel === 'moderate'
										? 'bg-yellow-500'
										: 'bg-green-500'
								}`}
								style={{ width: '25%' }}
							></div>
						</div>
					</div>

					{isLoading && (
						<div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
						</div>
					)}
				</div>
			)}

			{/* Loading Indicator */}
			{isLoading && !routeInfo && (
				<div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
					<div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
						<p className="mt-2 text-sm font-medium dark:text-white">
							Calculating route...
						</p>
					</div>
				</div>
			)}

			{/* Route Calculation Indicator - Small overlay */}
			{isLoading && (
				<div className="absolute top-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-lg shadow-lg">
					<div className="flex items-center space-x-2">
						<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
						<span className="text-sm font-medium dark:text-white">
							Calculating route...
						</span>
					</div>
				</div>
			)}

			{/* CSS for animations */}
			<style jsx>{`
				@keyframes pulse {
					0%,
					100% {
						transform: scale(1);
					}
					50% {
						transform: scale(1.1);
					}
				}
				@keyframes marker-pulse {
					0%,
					100% {
						transform: scale(1);
						box-shadow: 0 0 15px rgba(239, 68, 68, 0.6);
					}
					50% {
						transform: scale(1.15);
						box-shadow: 0 0 25px rgba(239, 68, 68, 0.8);
					}
				}
				@keyframes ring-pulse {
					0% {
						transform: scale(1);
						opacity: 1;
					}
					100% {
						transform: scale(2);
						opacity: 0;
					}
				}

				/* Custom marker styles */
				.custom-marker {
					cursor: pointer;
				}

				/* Delivery destination marker - red pin */
				.delivery-marker {
					position: relative;
					width: 30px;
					height: 30px;
				}

				.marker-pin {
					width: 30px;
					height: 30px;
					background: #ef4444;
					border: 3px solid white;
					border-radius: 50% 50% 50% 0;
					transform: rotate(-45deg);
					box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
					position: relative;
				}

				.marker-pin::after {
					content: '';
					position: absolute;
					top: 50%;
					left: 50%;
					width: 12px;
					height: 12px;
					background: white;
					border-radius: 50%;
					transform: translate(-50%, -50%) rotate(45deg);
				}

				.marker-pulse {
					position: absolute;
					top: 0;
					left: 0;
					width: 30px;
					height: 30px;
					background: rgba(239, 68, 68, 0.3);
					border-radius: 50% 50% 50% 0;
					transform: rotate(-45deg);
					animation: marker-pulse 2s infinite;
				}

				/* Driver location marker - blue circle */
				.driver-marker {
					position: relative;
					width: 24px;
					height: 24px;
				}

				.marker-circle {
					width: 24px;
					height: 24px;
					background: #3b82f6;
					border: 3px solid white;
					border-radius: 50%;
					box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
					position: relative;
					z-index: 2;
				}

				.marker-ring {
					position: absolute;
					top: 0;
					left: 0;
					width: 24px;
					height: 24px;
					background: rgba(59, 130, 246, 0.3);
					border-radius: 50%;
					animation: ring-pulse 2s infinite;
				}
			`}</style>
		</div>
	);
}
