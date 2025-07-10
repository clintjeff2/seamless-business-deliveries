'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import type { DeliveryStatus } from '@/lib/types';

interface DeliveryStatusCardProps {
	delivery: {
		id: string;
		status: DeliveryStatus;
		order_id: string;
	};
}

export function DeliveryStatusCard({ delivery }: DeliveryStatusCardProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const supabase = createClient();

	const getNextStatus = (
		currentStatus: DeliveryStatus
	): DeliveryStatus | null => {
		const flow: Record<DeliveryStatus, DeliveryStatus | null> = {
			pending: 'accepted',
			accepted: 'picked_up',
			picked_up: 'in_transit',
			in_transit: 'delivered',
			delivered: null,
			cancelled: null,
		};
		return flow[currentStatus];
	};

	const getActionButtonText = (status: DeliveryStatus): string => {
		const actions: Record<DeliveryStatus, string> = {
			pending: 'Accept Delivery',
			accepted: 'Mark as Picked Up',
			picked_up: 'Start Delivery',
			in_transit: 'Complete Delivery',
			delivered: 'Completed',
			cancelled: 'Cancelled',
		};
		return actions[status];
	};

	const handleStatusUpdate = async () => {
		const nextStatus = getNextStatus(delivery.status);
		if (!nextStatus) return;

		setLoading(true);
		setError(null);

		try {
			const { error: deliveryError } = await supabase
				.from('deliveries')
				.update({
					status: nextStatus,
					updated_at: new Date().toISOString(),
				})
				.eq('id', delivery.id);

			if (deliveryError) throw deliveryError;

			// If delivery is completed, update order status as well
			if (nextStatus === 'delivered') {
				const { error: orderError } = await supabase
					.from('orders')
					.update({
						status: 'completed',
						updated_at: new Date().toISOString(),
					})
					.eq('id', delivery.orders?.id);

				if (orderError) throw orderError;
			}

			router.refresh();
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Delivery Status</CardTitle>
				<CardDescription>Update delivery progress</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-gray-600">Current Status</p>
							<Badge
								variant={
									delivery.status === 'delivered' ? 'default' : 'secondary'
								}
							>
								{delivery.status.replace('_', ' ').toUpperCase()}
							</Badge>
						</div>
						{getNextStatus(delivery.status) && (
							<Button
								onClick={handleStatusUpdate}
								disabled={loading || !getNextStatus(delivery.status)}
							>
								{loading ? 'Updating...' : getActionButtonText(delivery.status)}
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
