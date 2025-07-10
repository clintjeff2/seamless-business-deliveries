'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { createClient } from '@/lib/supabase/client';
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

// Loading Skeleton Component
function LoadingSkeleton() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
				<div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
			</div>

			<div className="mb-6">
				<div className="h-10 bg-gray-200 rounded w-full animate-pulse" />
			</div>

			<div className="space-y-4">
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<CardHeader>
							<div className="flex justify-between">
								<div>
									<div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
									<div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
								</div>
								<div className="h-6 bg-gray-200 rounded w-20 animate-pulse" />
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
								<div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

export default function DeliveriesPage({
	params,
	searchParams,
}: {
	params: {};
	searchParams: { search?: string };
}) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [transportService, setTransportService] =
		useState<TransportService | null>(null);
	const [deliveries, setDeliveries] = useState<Delivery[]>([]);
	const router = useRouter();
	const supabase = createClient();
	const resolvedSearchParams = React.use(
		searchParams as unknown as Promise<{ search?: string }>
	);

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
						order_id,
						status,
						created_at,
						orders (
							id,
							total_amount,
							delivery_address,
							delivery_notes,
							business_id,
							business:business_id (name)
						)
					`
					)
					.eq('transport_service_id', service.id)
					.order('created_at', { ascending: false });

				if (resolvedSearchParams.search) {
					query = query.or(
						`delivery_address.ilike.%${resolvedSearchParams.search}%,orders.delivery_notes.ilike.%${resolvedSearchParams.search}%`
					);
				}

				const { data: deliveriesData, error: deliveriesError } = await query;

				console.log(deliveriesData);
				if (deliveriesError) throw deliveriesError;
				setDeliveries(deliveriesData || []);
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [resolvedSearchParams.search, router, supabase]);

	if (loading) {
		return <LoadingSkeleton />;
	}

	if (error) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto text-center">
					<h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
					<p className="text-gray-600">{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Delivery Requests</h1>
				<p className="text-gray-600">Manage your delivery requests</p>
			</div>

			<DeliverySearchForm initialSearch={resolvedSearchParams.search || ''} />

			<div className="space-y-4">
				{deliveries.length > 0 ? (
					deliveries.map((delivery) => (
						<Card key={delivery.id}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>
											Order #{delivery.orders?.id?.slice(0, 8)}
										</CardTitle>
										<CardDescription>
											From {delivery.orders?.business?.name}
										</CardDescription>
									</div>
									<Badge
										variant={
											delivery.status === 'delivered' ? 'default' : 'secondary'
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
											{delivery.orders?.business?.name}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium">Delivery Address</p>
										<p className="text-sm text-gray-600">
											{delivery.orders?.delivery_address}
										</p>
										{delivery.orders?.delivery_notes && (
											<p className="text-sm text-gray-600 mt-1">
												Note: {delivery.orders.delivery_notes}
											</p>
										)}
									</div>
									<DeliveryStatusCard delivery={delivery} />
								</div>
							</CardContent>
						</Card>
					))
				) : (
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
