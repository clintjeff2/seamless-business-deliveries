// 'use client';

// import { useEffect, useRef, useState, useCallback } from 'react';
// import mapboxgl from 'mapbox-gl';
// import {
// 	Moon,
// 	Sun,
// 	Navigation,
// 	Clock,
// 	MapPin,
// 	Truck,
// 	AlertTriangle,
// } from 'lucide-react';

// // Initialize Mapbox with access token
// mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// interface RouteInfo {
// 	distance: number;
// 	duration: number;
// 	durationInTraffic: number;
// 	geometry: any;
// 	steps: any[];
// }

// interface MapProps {
// 	center: [number, number];
// 	zoom?: number;
// 	markers?: Array<{
// 		position: [number, number];
// 		title?: string;
// 		color?: string;
// 	}>;
// 	className?: string;
// 	showLiveLocation?: boolean;
// 	destination?: [number, number];
// 	onRouteUpdate?: (routeInfo: RouteInfo) => void;
// }

// export function Map({
// 	center,
// 	zoom = 13,
// 	markers = [],
// 	className = '',
// 	showLiveLocation = false,
// 	destination,
// 	onRouteUpdate,
// }: MapProps) {
// 	const mapRef = useRef<HTMLDivElement>(null);
// 	const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
// 	const markersRef = useRef<mapboxgl.Marker[]>([]);
// 	const locationMarkerRef = useRef<mapboxgl.Marker | null>(null);
// 	const watchIdRef = useRef<number | null>(null);
// 	const routeLayerRef = useRef<string | null>(null);
// 	const [mapLoaded, setMapLoaded] = useState(false);
// 	const [styleLoaded, setStyleLoaded] = useState(false);
// 	const pendingRouteRef = useRef<{ start: [number, number]; end: [number, number] } | null>(null);

// 	const [userLocation, setUserLocation] = useState<[number, number] | null>(
// 		null
// 	);
// 	const [isDarkMode, setIsDarkMode] = useState(false);
// 	const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
// 	const [isLoading, setIsLoading] = useState(false);
// 	const [trafficLevel, setTrafficLevel] = useState<
// 		'low' | 'moderate' | 'heavy'
// 	>('moderate');

// 	// Auto dark mode based on time
// 	useEffect(() => {
// 		const hour = new Date().getHours();
// 		setIsDarkMode(hour < 6 || hour >= 19);
// 	}, []);

// 	// Wait for map to be ready before adding layers
// 	const waitForMapReady = useCallback(async (map: mapboxgl.Map): Promise<void> => {
// 		return new Promise((resolve) => {
// 			if (map.isStyleLoaded() && map.loaded()) {
// 				resolve();
// 			} else {
// 				const checkReady = () => {
// 					if (map.isStyleLoaded() && map.loaded()) {
// 						resolve();
// 					} else {
// 						setTimeout(checkReady, 100);
// 					}
// 				};
// 				checkReady();
// 			}
// 		});
// 	}, []);

// 	// Fetch route with traffic data
// 	const fetchRoute = useCallback(
// 		async (start: [number, number], end: [number, number]) => {
// 			if (!start || !end) return;

// 			const map = mapInstanceRef.current;
// 			if (!map) return;

// 			// Check if map is ready
// 			if (!map.isStyleLoaded() || !map.loaded()) {
// 				// Store the pending route request
// 				pendingRouteRef.current = { start, end };
// 				return;
// 			}

// 			setIsLoading(true);
// 			try {
// 				// Wait for map to be fully ready
// 				await waitForMapReady(map);

// 				const response = await fetch(
// 					`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
// 				);

// 				const data = await response.json();

// 				if (data.routes && data.routes.length > 0) {
// 					const route = data.routes[0];
// 					const routeData: RouteInfo = {
// 						distance: route.distance,
// 						duration: route.duration,
// 						durationInTraffic: route.duration_typical || route.duration,
// 						geometry: route.geometry,
// 						steps: route.legs[0]?.steps || [],
// 					};

// 					setRouteInfo(routeData);
// 					onRouteUpdate?.(routeData);

// 					// Determine traffic level
// 					const trafficFactor =
// 						routeData.durationInTraffic / routeData.duration;
// 					if (trafficFactor > 1.5) setTrafficLevel('heavy');
// 					else if (trafficFactor > 1.2) setTrafficLevel('moderate');
// 					else setTrafficLevel('low');

// 					// Add route to map
// 					if (map && map.isStyleLoaded()) {
// 						// Remove existing route
// 						if (routeLayerRef.current) {
// 							try {
// 								if (map.getLayer(routeLayerRef.current)) {
// 									map.removeLayer(routeLayerRef.current);
// 								}
// 								if (map.getSource(routeLayerRef.current)) {
// 									map.removeSource(routeLayerRef.current);
// 								}
// 							} catch (error) {
// 								// Ignore errors when removing non-existent layers
// 							}
// 						}

// 						const routeId = 'route-' + Date.now();
// 						routeLayerRef.current = routeId;

// 						map.addSource(routeId, {
// 							type: 'geojson',
// 							data: {
// 								type: 'Feature',
// 								properties: {},
// 								geometry: route.geometry,
// 							},
// 						});

// 						map.addLayer({
// 							id: routeId,
// 							type: 'line',
// 							source: routeId,
// 							layout: {
// 								'line-join': 'round',
// 								'line-cap': 'round',
// 							},
// 							paint: {
// 								'line-color':
// 									trafficLevel === 'heavy'
// 										? '#ff4444'
// 										: trafficLevel === 'moderate'
// 										? '#ff8800'
// 										: '#00aa00',
// 								'line-width': 5,
// 								'line-opacity': 0.8,
// 							},
// 						});

// 						// Fit bounds to show both locations
// 						const bounds = new mapboxgl.LngLatBounds();
// 						bounds.extend(start);
// 						bounds.extend(end);
// 						map.fitBounds(bounds, { padding: 50 });
// 					}
// 				}
// 			} catch (error) {
// 				console.error('Error fetching route:', error);
// 			} finally {
// 				setIsLoading(false);
// 			}
// 		},
// 		[onRouteUpdate, waitForMapReady]
// 	);

// 	// Initialize map
// 	useEffect(() => {
// 		if (!mapRef.current || mapInstanceRef.current) return;

// 		const map = new mapboxgl.Map({
// 			container: mapRef.current,
// 			style: isDarkMode
// 				? 'mapbox://styles/mapbox/dark-v11'
// 				: 'mapbox://styles/mapbox/streets-v12',
// 			center: center,
// 			zoom: zoom,
// 		});

// 		// Add navigation controls
// 		map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// 		// Handle map load events
// 		map.on('load', () => {
// 			setMapLoaded(true);
// 			setStyleLoaded(true);
			
// 			// Add traffic layer
// 			map.addSource('mapbox-traffic', {
// 				type: 'vector',
// 				url: 'mapbox://mapbox.mapbox-traffic-v1',
// 			});

// 			map.addLayer({
// 				id: 'traffic-layer',
// 				type: 'line',
// 				source: 'mapbox-traffic',
// 				'source-layer': 'traffic',
// 				layout: {
// 					'line-join': 'round',
// 					'line-cap': 'round',
// 				},
// 				paint: {
// 					'line-color': [
// 						'case',
// 						['==', ['get', 'congestion'], 'low'],
// 						'#00ff00',
// 						['==', ['get', 'congestion'], 'moderate'],
// 						'#ffff00',
// 						['==', ['get', 'congestion'], 'heavy'],
// 						'#ff6600',
// 						['==', ['get', 'congestion'], 'severe'],
// 						'#ff0000',
// 						'#888888',
// 					],
// 					'line-width': 3,
// 					'line-opacity': 0.8,
// 				},
// 			});
// 		});

// 		// Handle style load events
// 		map.on('styledata', () => {
// 			setStyleLoaded(true);
// 			// Process pending route if any
// 			if (pendingRouteRef.current) {
// 				const { start, end } = pendingRouteRef.current;
// 				pendingRouteRef.current = null;
// 				fetchRoute(start, end);
// 			}
// 		});

// 		mapInstanceRef.current = map;

// 		return () => {
// 			map.remove();
// 			mapInstanceRef.current = null;
// 			setMapLoaded(false);
// 			setStyleLoaded(false);
// 		};
// 	}, [center, zoom, isDarkMode, fetchRoute]);

// 	// Update map style when dark mode changes
// 	useEffect(() => {
// 		const map = mapInstanceRef.current;
// 		if (!map) return;

// 		setStyleLoaded(false);
// 		map.setStyle(
// 			isDarkMode
// 				? 'mapbox://styles/mapbox/dark-v11'
// 				: 'mapbox://styles/mapbox/streets-v12'
// 		);
// 	}, [isDarkMode]);

// 	// Handle markers
// 	useEffect(() => {
// 		const map = mapInstanceRef.current;
// 		if (!map || !mapLoaded) return;

// 		// Clear existing markers
// 		markersRef.current.forEach((marker) => marker.remove());
// 		markersRef.current = [];

// 		// Add new markers
// 		markers.forEach(({ position, title, color = '#FF0000' }) => {
// 			const element = document.createElement('div');
// 			element.className = 'marker';
// 			element.style.width = '32px';
// 			element.style.height = '32px';
// 			element.style.borderRadius = '50%';
// 			element.style.backgroundColor = color;
// 			element.style.border = '3px solid white';
// 			element.style.boxShadow = '0 0 8px rgba(0,0,0,0.4)';
// 			element.style.cursor = 'pointer';

// 			// Add pulsing animation for delivery destination
// 			if (title?.includes('Delivery')) {
// 				element.style.animation = 'pulse 2s infinite';
// 			}

// 			const marker = new mapboxgl.Marker({ element }).setLngLat(position);

// 			if (map) {
// 				marker.addTo(map);
// 			}

// 			if (title) {
// 				marker.setPopup(
// 					new mapboxgl.Popup({ offset: 25 }).setHTML(
// 						`<div class="p-2 font-semibold">${title}</div>`
// 					)
// 				);
// 			}

// 			markersRef.current.push(marker);
// 		});
// 	}, [markers, mapLoaded]);

// 	// Handle live location tracking
// 	useEffect(() => {
// 		const map = mapInstanceRef.current;
// 		if (!map || !showLiveLocation) return;

// 		const handlePositionUpdate = (position: GeolocationPosition) => {
// 			const { latitude, longitude } = position.coords;
// 			const newLocation: [number, number] = [longitude, latitude];
// 			setUserLocation(newLocation);

// 			if (!locationMarkerRef.current) {
// 				const element = document.createElement('div');
// 				element.className = 'location-marker';
// 				element.innerHTML = `
//           <div class="relative">
//             <div class="w-8 h-8 bg-blue-500 rounded-full border-3 border-white shadow-lg"></div>
//             <div class="absolute top-0 left-0 w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-75"></div>
//           </div>
//         `;
// 				locationMarkerRef.current = new mapboxgl.Marker({ element })
// 					.setLngLat(newLocation)
// 					.addTo(map);
// 			} else {
// 				locationMarkerRef.current.setLngLat(newLocation);
// 			}

// 			// Update route if destination is set
// 			if (destination && newLocation) {
// 				fetchRoute(newLocation, destination);
// 			}
// 		};

// 		if (navigator.geolocation) {
// 			watchIdRef.current = navigator.geolocation.watchPosition(
// 				handlePositionUpdate,
// 				(error) => console.error('Error getting location:', error),
// 				{ enableHighAccuracy: true, maximumAge: 10000 }
// 			);
// 		}

// 		return () => {
// 			if (watchIdRef.current !== null) {
// 				navigator.geolocation.clearWatch(watchIdRef.current);
// 			}
// 			locationMarkerRef.current?.remove();
// 			locationMarkerRef.current = null;
// 		};
// 	}, [showLiveLocation, destination, fetchRoute]);

// 	// Format time duration
// 	const formatDuration = (seconds: number): string => {
// 		const hours = Math.floor(seconds / 3600);
// 		const minutes = Math.floor((seconds % 3600) / 60);
// 		if (hours > 0) return `${hours}h ${minutes}m`;
// 		return `${minutes}m`;
// 	};

// 	// Format distance
// 	const formatDistance = (meters: number): string => {
// 		if (meters >= 1000) {
// 			return `${(meters / 1000).toFixed(1)} km`;
// 		}
// 		return `${Math.round(meters)} m`;
// 	};

// 	return (
// 		<div className={`relative w-full h-full ${className}`}>
// 			{/* Map Container */}
// 			<div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />

// 			{/* Controls Overlay */}
// 			<div className="absolute top-4 left-4 space-y-2">
// 				{/* Dark Mode Toggle */}
// 				<button
// 					onClick={() => setIsDarkMode(!isDarkMode)}
// 					className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
// 				>
// 					{isDarkMode ? (
// 						<Sun className="h-5 w-5 text-yellow-600" />
// 					) : (
// 						<Moon className="h-5 w-5 text-gray-600" />
// 					)}
// 				</button>

// 				{/* Traffic Level Indicator */}
// 				<div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
// 					<div className="flex items-center space-x-2">
// 						<AlertTriangle
// 							className={`h-4 w-4 ${
// 								trafficLevel === 'heavy'
// 									? 'text-red-500'
// 									: trafficLevel === 'moderate'
// 									? 'text-yellow-500'
// 									: 'text-green-500'
// 							}`}
// 						/>
// 						<span className="text-sm font-medium capitalize dark:text-white">
// 							{trafficLevel} Traffic
// 						</span>
// 					</div>
// 				</div>

// 				{/* Map Status Indicator */}
// 				{!styleLoaded && (
// 					<div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
// 						<div className="flex items-center space-x-2">
// 							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
// 							<span className="text-sm font-medium dark:text-white">
// 								Loading Map...
// 							</span>
// 						</div>
// 					</div>
// 				)}
// 			</div>

// 			{/* Route Info Panel */}
// 			{routeInfo && (
// 				<div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-4">
// 					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
// 						<div className="flex items-center space-x-2">
// 							<MapPin className="h-5 w-5 text-blue-500" />
// 							<div>
// 								<p className="text-sm font-medium dark:text-white">Distance</p>
// 								<p className="text-lg font-bold text-blue-600 dark:text-blue-400">
// 									{formatDistance(routeInfo.distance)}
// 								</p>
// 							</div>
// 						</div>

// 						<div className="flex items-center space-x-2">
// 							<Clock className="h-5 w-5 text-green-500" />
// 							<div>
// 								<p className="text-sm font-medium dark:text-white">ETA</p>
// 								<p className="text-lg font-bold text-green-600 dark:text-green-400">
// 									{formatDuration(routeInfo.durationInTraffic)}
// 								</p>
// 							</div>
// 						</div>

// 						<div className="flex items-center space-x-2">
// 							<Truck className="h-5 w-5 text-orange-500" />
// 							<div>
// 								<p className="text-sm font-medium dark:text-white">
// 									With Traffic
// 								</p>
// 								<p className="text-lg font-bold text-orange-600 dark:text-orange-400">
// 									+
// 									{formatDuration(
// 										routeInfo.durationInTraffic - routeInfo.duration
// 									)}
// 								</p>
// 							</div>
// 						</div>

// 						<div className="flex items-center space-x-2">
// 							<Navigation className="h-5 w-5 text-purple-500" />
// 							<div>
// 								<p className="text-sm font-medium dark:text-white">Route</p>
// 								<p className="text-lg font-bold text-purple-600 dark:text-purple-400">
// 									Optimal
// 								</p>
// 							</div>
// 						</div>
// 					</div>

// 					{/* Progress Bar */}
// 					<div className="mt-4">
// 						<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
// 							<span>Current Location</span>
// 							<span>Destination</span>
// 						</div>
// 						<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
// 							<div
// 								className={`h-2 rounded-full ${
// 									trafficLevel === 'heavy'
// 										? 'bg-red-500'
// 										: trafficLevel === 'moderate'
// 										? 'bg-yellow-500'
// 										: 'bg-green-500'
// 								}`}
// 								style={{ width: '25%' }} // This would be calculated based on actual progress
// 							></div>
// 						</div>
// 					</div>

// 					{isLoading && (
// 						<div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
// 							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
// 						</div>
// 					)}
// 				</div>
// 			)}

// 			{/* Loading Indicator */}
// 			{isLoading && !routeInfo && (
// 				<div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
// 					<div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
// 						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
// 						<p className="mt-2 text-sm font-medium dark:text-white">
// 							Calculating route...
// 						</p>
// 					</div>
// 				</div>
// 			)}

// 			{/* CSS for animations */}
// 			<style jsx>{`
// 				@keyframes pulse {
// 					0%,
// 					100% {
// 						transform: scale(1);
// 					}
// 					50% {
// 						transform: scale(1.1);
// 					}
// 				}
// 				.marker {
// 					animation: pulse 2s infinite;
// 				}
// 			`}</style>
// 		</div>
// 	);
// }

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
	const routeRequestRef = useRef<{ start: [number, number]; end: [number, number] } | null>(null);
	const lastRouteRef = useRef<string>('');

	const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
	const [isDarkMode, setIsDarkMode] = useState(false);
	const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [trafficLevel, setTrafficLevel] = useState<'low' | 'moderate' | 'heavy'>('moderate');

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
					const trafficFactor = routeData.durationInTraffic / routeData.duration;
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

		// Add new markers
		markers.forEach(({ position, title, color = '#FF0000' }) => {
			const element = document.createElement('div');
			element.className = 'marker';
			element.style.width = '32px';
			element.style.height = '32px';
			element.style.borderRadius = '50%';
			element.style.backgroundColor = color;
			element.style.border = '3px solid white';
			element.style.boxShadow = '0 0 8px rgba(0,0,0,0.4)';
			element.style.cursor = 'pointer';

			// Add pulsing animation for delivery destination
			if (title?.includes('Delivery')) {
				element.style.animation = 'pulse 2s infinite';
			}

			const marker = new mapboxgl.Marker({ element }).setLngLat(position);
			marker.addTo(map);

			if (title) {
				marker.setPopup(
					new mapboxgl.Popup({ offset: 25 }).setHTML(
						`<div class="p-2 font-semibold">${title}</div>`
					)
				);
			}

			markersRef.current.push(marker);
		});
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
									+{formatDuration(routeInfo.durationInTraffic - routeInfo.duration)}
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

			{/* CSS for animations */}
			<style jsx>{`
				@keyframes pulse {
					0%, 100% {
						transform: scale(1);
					}
					50% {
						transform: scale(1.1);
					}
				}
				.marker {
					animation: pulse 2s infinite;
				}
			`}</style>
		</div>
	);
}