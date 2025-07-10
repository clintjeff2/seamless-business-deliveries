'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';
import { DeliverySearchForm } from '@/components/transport/DeliverySearchForm';
import { DeliveryStatusCard } from '@/components/transport/DeliveryStatusCard';
import type { TransportService, Delivery } from '@/lib/types';

export default function DeliveriesPage({
	searchParams,
}: {
	searchParams: { search?: string };
}) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [transportService, setTransportService] =
		useState<TransportService | null>(null);
	const [deliveries, setDeliveries] = useState<Delivery[]>([]);
	const router = useRouter();
	const supabase = createClient();

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Get user and check role
				const {
					data: { user },
					error: authError,
				} = await supabase.auth.getUser();
				if (authError || !user) {
					router.push('/login');
					return;
				}

				// Check role
				const { data: profile } = await supabase
					.from('profiles')
					.select('role')
					.eq('id', user.id)
					.single();

				if (profile?.role !== 'transport') {
					router.push('/unauthorized');
					return;
				}

				// Fetch transport service info
				const { data: service, error: serviceError } = await supabase
					.from('transport_services')
					.select('*')
					.eq('driver_id', user.id)
					.single();

				if (serviceError) throw serviceError;
				setTransportService(service);

				// Fetch deliveries with search filter
				let query = supabase
					.from('deliveries')
					.select(
						`
                        *,
                        order:orders(
                            id,
                            total_amount,
                            delivery_address,
                            delivery_notes,
                            business:businesses(name)
                        )
                    `
					)
					.eq('transport_service_id', service.id)
					.order('created_at', { ascending: false });

				if (searchParams.search) {
					query = query.or(
						`delivery_address.ilike.%${searchParams.search}%,order.delivery_notes.ilike.%${searchParams.search}%`
					);
				}

				const { data: deliveriesData, error: deliveriesError } = await query;

				if (deliveriesError) throw deliveriesError;
				setDeliveries(deliveriesData || []);
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [searchParams.search, router, supabase]);

	if (loading) {
		return <div>Loading...</div>;
	}

	if (error) {
		return <div>Error: {error}</div>;
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Delivery Requests</h1>
				<p className="text-gray-600">Manage your delivery requests</p>
			</div>

			<DeliverySearchForm initialSearch={searchParams.search || ''} />

			<div className="grid gap-6 mt-8">
				{transportService && (
					<DeliveryStatusCard transportService={transportService} />
				)}

				{deliveries.map((delivery) => (
					<Card key={delivery.id}>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Order #{delivery.order?.id.slice(0, 8)}</CardTitle>
									<CardDescription>
										{format(
											new Date(delivery.created_at),
											"MMM dd, yyyy 'at' hh:mm a"
										)}
									</CardDescription>
								</div>
								<Badge
									variant={
										delivery.status === 'delivered'
											? 'default'
											: delivery.status === 'in_transit'
											? 'outline'
											: 'secondary'
									}
								>
									{delivery.status.replace('_', ' ').toUpperCase()}
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<p className="text-sm font-medium">From</p>
									<p className="text-sm text-gray-600">
										{delivery.order?.business?.name}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium">Delivery Address</p>
									<p className="text-sm text-gray-600">
										{delivery.order?.delivery_address}
									</p>
									{delivery.order?.delivery_notes && (
										<p className="text-sm text-gray-600 mt-1">
											Note: {delivery.order.delivery_notes}
										</p>
									)}
								</div>
							</div>
						</CardContent>
					</Card>
				))}

				{deliveries.length === 0 && (
					<Card>
						<CardContent className="p-8 text-center">
							<Truck className="mx-auto h-12 w-12 text-gray-400" />
							<p className="mt-4 text-gray-600">No delivery requests found</p>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
