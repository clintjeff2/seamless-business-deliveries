import { createClient } from '@/lib/supabase/client';

export const updateTransportLocation = async (
	transportId: string,
	latitude: number,
	longitude: number
) => {
	const supabase = createClient();
	const { error } = await supabase
		.from('transport_services')
		.update({
			current_latitude: latitude,
			current_longitude: longitude,
			updated_at: new Date().toISOString(),
		})
		.eq('id', transportId);

	if (error) {
		console.error('Error updating location:', error);
		throw error;
	}
};

export const watchLocation = (
	transportId: string,
	onError?: (error: GeolocationPositionError) => void
) => {
	if (!navigator.geolocation) {
		throw new Error('Geolocation is not supported by this browser');
	}

	const watchId = navigator.geolocation.watchPosition(
		async (position) => {
			try {
				await updateTransportLocation(
					transportId,
					position.coords.latitude,
					position.coords.longitude
				);
			} catch (error) {
				console.error('Error updating location:', error);
			}
		},
		(error) => {
			console.error('Geolocation error:', error);
			onError?.(error);
		},
		{
			enableHighAccuracy: true,
			timeout: 5000,
			maximumAge: 0,
		}
	);

	return () => {
		navigator.geolocation.clearWatch(watchId);
	};
};
