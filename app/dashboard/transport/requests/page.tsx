'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Clock, CheckCircle, Package, XCircle } from 'lucide-react';
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

			<div className="mb-6">
				<div className="h-12 bg-gray-200 rounded w-full animate-pulse" />
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
	searchParams: { search?: string; status?: string };
}) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [transportService, setTransportService] =
		useState<TransportService | null>(null);
	const [deliveries, setDeliveries] = useState<Delivery[]>([]);
	const [activeTab, setActiveTab] = useState<string>('all');
	const router = useRouter();
	const searchParamsHook = useSearchParams();
	const supabase = createClient();
	const resolvedSearchParams = React.use(
		searchParams as unknown as Promise<{ search?: string; status?: string }>
	);

	useEffect(() => {
		// Set active tab from URL params
		if (resolvedSearchParams.status) {
			setActiveTab(resolvedSearchParams.status);
		}
	}, [resolvedSearchParams.status]);

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

				if (deliveriesError) throw deliveriesError;
				setDeliveries(deliveriesData || []);

				// Set up real-time subscription for delivery updates
				const deliveryChannel = supabase
					.channel('transport-deliveries-updates')
					.on(
						'postgres_changes',
						{
							event: 'UPDATE',
							schema: 'public',
							table: 'deliveries',
							filter: `transport_service_id=eq.${service.id}`,
						},
						(payload) => {
							setDeliveries((prevDeliveries) =>
								prevDeliveries.map((delivery) =>
									delivery.id === payload.new.id
										? { ...delivery, ...payload.new }
										: delivery
								)
							);
						}
					)
					.subscribe();

				return () => {
					deliveryChannel.unsubscribe();
				};
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, [resolvedSearchParams.search, router, supabase]);

	const handleTabChange = (value: string) => {
		setActiveTab(value);
		const params = new URLSearchParams(searchParamsHook);

		if (value === 'all') {
			params.delete('status');
		} else {
			params.set('status', value);
		}

		if (resolvedSearchParams.search) {
			params.set('search', resolvedSearchParams.search);
		}

		router.push(`/dashboard/transport/requests?${params.toString()}`);
	};

	const filterDeliveriesByStatus = (status: string) => {
		if (status === 'all') return deliveries;
		if (status === 'active') {
			return deliveries.filter((d) =>
				['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status)
			);
		}
		return deliveries.filter((d) => d.status === status);
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'pending':
				return <Clock className="h-4 w-4" />;
			case 'accepted':
			case 'picked_up':
				return <Package className="h-4 w-4" />;
			case 'in_transit':
				return <Truck className="h-4 w-4" />;
			case 'delivered':
				return <CheckCircle className="h-4 w-4" />;
			case 'cancelled':
				return <XCircle className="h-4 w-4" />;
			default:
				return <Clock className="h-4 w-4" />;
		}
	};

	const getStatusCounts = () => {
		return {
			all: deliveries.length,
			active: deliveries.filter((d) =>
				['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status)
			).length,
			pending: deliveries.filter((d) => d.status === 'pending').length,
			accepted: deliveries.filter((d) => d.status === 'accepted').length,
			picked_up: deliveries.filter((d) => d.status === 'picked_up').length,
			in_transit: deliveries.filter((d) => d.status === 'in_transit').length,
			delivered: deliveries.filter((d) => d.status === 'delivered').length,
			cancelled: deliveries.filter((d) => d.status === 'cancelled').length,
		};
	};

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

	const statusCounts = getStatusCounts();
	const filteredDeliveries = filterDeliveriesByStatus(activeTab);

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Delivery Requests</h1>
				<p className="text-gray-600">Manage your delivery requests</p>
			</div>

			<DeliverySearchForm initialSearch={resolvedSearchParams.search || ''} />

			<Tabs
				value={activeTab}
				onValueChange={handleTabChange}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-8 mb-6">
					<TabsTrigger value="all" className="flex items-center gap-1">
						<span className="hidden sm:inline">All</span>
						<span className="text-xs">({statusCounts.all})</span>
					</TabsTrigger>
					<TabsTrigger value="active" className="flex items-center gap-1">
						<span className="hidden sm:inline">Active</span>
						<span className="text-xs">({statusCounts.active})</span>
					</TabsTrigger>
					<TabsTrigger value="pending" className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						<span className="hidden sm:inline">Pending</span>
						<span className="text-xs">({statusCounts.pending})</span>
					</TabsTrigger>
					<TabsTrigger value="accepted" className="flex items-center gap-1">
						<Package className="h-3 w-3" />
						<span className="hidden sm:inline">Accepted</span>
						<span className="text-xs">({statusCounts.accepted})</span>
					</TabsTrigger>
					<TabsTrigger value="picked_up" className="flex items-center gap-1">
						<Package className="h-3 w-3" />
						<span className="hidden sm:inline">Picked Up</span>
						<span className="text-xs">({statusCounts.picked_up})</span>
					</TabsTrigger>
					<TabsTrigger value="in_transit" className="flex items-center gap-1">
						<Truck className="h-3 w-3" />
						<span className="hidden sm:inline">In Transit</span>
						<span className="text-xs">({statusCounts.in_transit})</span>
					</TabsTrigger>
					<TabsTrigger value="delivered" className="flex items-center gap-1">
						<CheckCircle className="h-3 w-3" />
						<span className="hidden sm:inline">Delivered</span>
						<span className="text-xs">({statusCounts.delivered})</span>
					</TabsTrigger>
					<TabsTrigger value="cancelled" className="flex items-center gap-1">
						<XCircle className="h-3 w-3" />
						<span className="hidden sm:inline">Cancelled</span>
						<span className="text-xs">({statusCounts.cancelled})</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent value={activeTab}>
					<div className="space-y-4">
						{filteredDeliveries.length > 0 ? (
							filteredDeliveries.map((delivery) => (
								<Card
									key={delivery.id}
									className="transition-all hover:shadow-md"
								>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div>
												<CardTitle className="flex items-center gap-2">
													{getStatusIcon(delivery.status)}
													Order #{delivery.orders?.id?.slice(0, 8)}
												</CardTitle>
												<CardDescription>
													From {delivery.orders?.business?.name}
												</CardDescription>
											</div>
											<Badge
												variant={
													delivery.status === 'delivered'
														? 'default'
														: delivery.status === 'cancelled'
														? 'destructive'
														: delivery.status === 'in_transit'
														? 'default'
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
									<p className="mt-4 text-gray-600">
										No {activeTab === 'all' ? '' : activeTab} delivery requests
										found
									</p>
									{activeTab !== 'all' && (
										<p className="text-sm text-gray-500 mt-2">
											Try switching to a different status tab
										</p>
									)}
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
