'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

// Initialize Mapbox with access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
console.log(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
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
}

export function Map({
	center,
	zoom = 13,
	markers = [],
	className = '',
	showLiveLocation = false,
}: MapProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
	const markersRef = useRef<mapboxgl.Marker[]>([]);
	const locationMarkerRef = useRef<mapboxgl.Marker | null>(null);
	const watchIdRef = useRef<number | null>(null);
	const [userLocation, setUserLocation] = useState<[number, number] | null>(
		null
	);

	// Initialize map
	useEffect(() => {
		if (!mapRef.current || mapInstanceRef.current) return;

		const map = new mapboxgl.Map({
			container: mapRef.current,
			style: 'mapbox://styles/mapbox/streets-v12',
			center: center,
			zoom: zoom,
		});

		// Add navigation controls
		map.addControl(new mapboxgl.NavigationControl(), 'top-right');

		mapInstanceRef.current = map;

		return () => {
			map.remove();
			mapInstanceRef.current = null;
		};
	}, [center, zoom]);

	// Handle markers
	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map) return;

		// Clear existing markers
		markersRef.current.forEach((marker) => marker.remove());
		markersRef.current = [];

		// Add new markers
		markers.forEach(({ position, title, color = '#FF0000' }) => {
			const element = document.createElement('div');
			element.className = 'marker';
			element.style.width = '24px';
			element.style.height = '24px';
			element.style.borderRadius = '50%';
			element.style.backgroundColor = color;
			element.style.border = '2px solid white';
			element.style.boxShadow = '0 0 4px rgba(0,0,0,0.3)';

			const marker = new mapboxgl.Marker({ element }).setLngLat(position);

			if (map) {
				marker.addTo(map);
			}

			if (title) {
				marker.setPopup(new mapboxgl.Popup().setHTML(title));
			}

			markersRef.current.push(marker);
		});
	}, [markers]);

	// Handle live location tracking
	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !showLiveLocation) return;

		const handlePositionUpdate = (position: GeolocationPosition) => {
			const { latitude, longitude } = position.coords;
			const newLocation: [number, number] = [longitude, latitude];
			setUserLocation(newLocation);

			if (!locationMarkerRef.current) {
				const element = document.createElement('div');
				element.className = 'location-marker';
				element.innerHTML = `
          <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg relative">
            <div class="absolute w-full h-full rounded-full bg-blue-500 animate-ping opacity-75"></div>
          </div>
        `;
				locationMarkerRef.current = new mapboxgl.Marker({ element })
					.setLngLat(newLocation)
					.addTo(map);
			} else {
				locationMarkerRef.current.setLngLat(newLocation);
			}

			map.flyTo({ center: newLocation, zoom: 15 });
		};

		if (navigator.geolocation) {
			watchIdRef.current = navigator.geolocation.watchPosition(
				handlePositionUpdate,
				(error) => console.error('Error getting location:', error),
				{ enableHighAccuracy: true }
			);
		}

		return () => {
			if (watchIdRef.current !== null) {
				navigator.geolocation.clearWatch(watchIdRef.current);
			}
			locationMarkerRef.current?.remove();
			locationMarkerRef.current = null;
		};
	}, [showLiveLocation]);

	return (
		<div
			ref={mapRef}
			className={`w-full h-full rounded-lg overflow-hidden ${className}`}
		/>
	);
}
