'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import type { TransportService } from '@/lib/types';
import { watchLocation } from '@/lib/location';

interface ServiceStatusCardProps {
	transportService: TransportService;
}

export function ServiceStatusCard({
	transportService,
}: ServiceStatusCardProps) {
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const supabase = createClient();

	// Set up location tracking when online
	useEffect(() => {
		let cleanup: (() => void) | undefined;

		if (transportService.status === 'available') {
			// Start watching location
			cleanup = watchLocation(transportService.id, (error) => {
				console.error('Geolocation error:', error);
				// If there's a critical error, set service to offline
				if (error.code === error.PERMISSION_DENIED) {
					toggleServiceStatus();
				}
			});
		}

		return () => {
			if (cleanup) {
				cleanup();
			}
		};
	}, [transportService.status, transportService.id]);

	async function toggleServiceStatus() {
		setIsLoading(true);

		try {
			const newStatus =
				transportService.status === 'available' ? 'offline' : 'available';

			const { error } = await supabase
				.from('transport_services')
				.update({
					status: newStatus,
					// Clear location when going offline
					...(newStatus === 'offline'
						? {
								current_latitude: null,
								current_longitude: null,
						  }
						: {}),
				})
				.eq('id', transportService.id);

			if (error) {
				console.error('Error updating status:', error);
				return;
			}

			// Refresh the page to reflect the updated status
			router.refresh();
		} catch (error) {
			console.error('Error updating status:', error);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Service Status</CardTitle>
				<CardDescription>Manage your availability</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<span>Current Status</span>
						<Badge
							variant={
								transportService.status === 'available'
									? 'default'
									: 'secondary'
							}
						>
							{transportService.status}
						</Badge>
					</div>
					{transportService.status === 'available' && (
						<p className="text-sm text-green-600">
							Location tracking is active. Your location will be updated
							automatically.
						</p>
					)}
					<Button
						className="w-full"
						onClick={toggleServiceStatus}
						disabled={isLoading}
					>
						{isLoading
							? 'Updating...'
							: transportService.status === 'available'
							? 'Go Offline'
							: 'Go Online'}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
