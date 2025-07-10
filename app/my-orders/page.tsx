'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Eye, Star } from 'lucide-react';
import type { Order, DeliveryStatus, OrderStatus } from '@/lib/types';
import { format } from 'date-fns';

export default function MyOrdersPage() {
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const supabase = createClient();

	useEffect(() => {
		const fetchOrders = async () => {
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user) {
					router.push('/login');
					return;
				}

				const { data, error } = await supabase
					.from('orders')
					.select(
						`
            *,
            business:businesses(name, logo_url),
            delivery:deliveries(
              id,
              status,
              estimated_delivery_time,
              transport_service:transport_services(service_name, phone)
            )
          `
					)
					.eq('user_id', user.id)
					.order('created_at', { ascending: false });

				if (error) throw error;
				setOrders(data || []);
			} catch (err: any) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		fetchOrders();

		// Subscribe to both order and delivery updates
		const orderChannel = supabase
			.channel('orders-updates')
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'orders',
				},
				(payload) => {
					setOrders((prevOrders) =>
						prevOrders.map((order) =>
							order.id === payload.new.id ? { ...order, ...payload.new } : order
						)
					);
				}
			)
			.subscribe();

		const deliveryChannel = supabase
			.channel('deliveries-updates')
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'deliveries',
				},
				(payload) => {
					setOrders((prevOrders) =>
						prevOrders.map((order) =>
							order.delivery?.id === payload.new.id
								? {
										...order,
										delivery: { ...order.delivery, ...payload.new },
								  }
								: order
						)
					);
				}
			)
			.subscribe();

		return () => {
			orderChannel.unsubscribe();
			deliveryChannel.unsubscribe();
		};
	}, [router, supabase]);

	const getOrderStatus = (
		order: Order
	): {
		label: string;
		variant: 'default' | 'secondary' | 'outline' | 'destructive';
	} => {
		if (order.status === 'cancelled') {
			return { label: 'Cancelled', variant: 'destructive' };
		}

		if (order.delivery?.[0]) {
			switch (order.delivery[0].status) {
				case 'pending':
					return { label: 'Confirmed, Awaiting Driver', variant: 'secondary' };
				case 'accepted':
					return { label: 'Driver Assigned', variant: 'outline' };
				case 'picked_up':
					return { label: 'Order Picked Up', variant: 'outline' };
				case 'in_transit':
					return { label: 'In Transit', variant: 'outline' };
				case 'delivered':
					return { label: 'Delivered', variant: 'default' };
				default:
					return {
						label: order.delivery[0].status.toUpperCase(),
						variant: 'secondary',
					};
			}
		}

		return {
			label: order.status.toUpperCase(),
			variant: order.status === 'completed' ? 'default' : 'secondary',
		};
	};

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<div className="animate-pulse space-y-4">
						<div className="h-8 bg-gray-200 rounded w-1/3"></div>
						<div className="space-y-6">
							{[1, 2, 3].map((i) => (
								<div key={i} className="h-48 bg-gray-200 rounded"></div>
							))}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">My Orders</h1>
					<p className="text-gray-600">
						Track your orders and view order history
					</p>
				</div>

				{error ? (
					<div className="text-center py-16">
						<p className="text-red-500 font-semibold">{error}</p>
					</div>
				) : orders.length === 0 ? (
					<div className="text-center py-16">
						<p className="text-gray-600">You haven't placed any orders yet</p>
						<Button asChild className="mt-4">
							<Link href="/businesses">Browse Businesses</Link>
						</Button>
					</div>
				) : (
					<div className="space-y-6">
						{orders.map((order) => (
							<Card key={order.id}>
								<CardHeader>
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-4">
											<div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
												{order.business?.logo_url ? (
													<img
														src={order.business.logo_url}
														alt={order.business.name}
														className="object-cover w-full h-full"
													/>
												) : (
													<div className="w-8 h-8 bg-gray-200 rounded" />
												)}
											</div>
											<div>
												<h3 className="font-semibold">
													{order.business?.name}
												</h3>
												<p className="text-sm text-gray-600">
													Order #{order.id.slice(0, 8)}
												</p>
											</div>
										</div>
										<Badge variant={getOrderStatus(order).variant}>
											{getOrderStatus(order).label}
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="flex justify-between text-sm text-gray-600">
											<span>Total Amount</span>
											<span className="font-semibold">
												${order.total_amount.toFixed(2)}
											</span>
										</div>

										{order.delivery?.[0] && (
											<div className="text-sm text-gray-600">
												<p className="mb-1">
													<MapPin className="h-4 w-4 inline mr-1" />
													{order.delivery_address}
												</p>
												{order.delivery[0].estimated_delivery_time && (
													<p>
														Estimated Delivery:{' '}
														{format(
															new Date(
																order.delivery[0].estimated_delivery_time
															),
															"MMM d, yyyy 'at' h:mm a"
														)}
													</p>
												)}
											</div>
										)}

										<div className="flex items-center justify-between mt-6">
											<div className="flex space-x-2">
												{order.delivery?.[0]?.status === 'in_transit' && (
													<Button asChild size="sm">
														<Link
															href={`/delivery/${order.delivery[0].id}/track`}
														>
															<MapPin className="h-4 w-4 mr-2" />
															Track Delivery
														</Link>
													</Button>
												)}

												<Button asChild variant="outline" size="sm">
													<Link href={`/orders/${order.id}`}>
														<Eye className="h-4 w-4 mr-2" />
														View Details
													</Link>
												</Button>
											</div>

											{order.delivery?.[0]?.status === 'delivered' && (
												<Button variant="outline" size="sm">
													<Star className="h-4 w-4 mr-2" />
													Leave Review
												</Button>
											)}
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
