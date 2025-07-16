'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import React from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import type { Order, OrderStatus } from '@/lib/types';
import { formatXAF } from '@/lib/utils';

// Loading spinner component
function LoadingSpinner() {
	return (
		<div className="flex justify-center items-center h-[200px]">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	);
}

export default function OrderDetailPage({
	params,
}: {
	params: Promise<{ orderId: string }>;
}) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [order, setOrder] = useState<Order | null>(null);
	const router = useRouter();
	const supabase = createClient();
	const resolvedParams = React.use(params);

	useEffect(() => {
		let mounted = true;

		const fetchOrder = async () => {
			try {
				if (!resolvedParams.orderId) {
					throw new Error('Order ID is required');
				}

				const {
					data: { user },
					error: authError,
				} = await supabase.auth.getUser();
				if (authError || !user) {
					router.push('/login');
					return;
				}

				// Fetch order and business in parallel for better performance
				const [orderResponse, businessResponse] = await Promise.all([
					supabase
						.from('orders')
						.select(
							`
            *,
            business:businesses(name),
            order_items(*, item:items(name, price)),
            delivery:deliveries(
              id,
              status,
              transport_service:transport_services(service_name, phone)
            )
          `
						)
						.eq('id', resolvedParams.orderId)
						.single(),

					supabase
						.from('businesses')
						.select('id')
						.eq('owner_id', user.id)
						.single(),
				]);

				if (orderResponse.error) throw orderResponse.error;
				if (businessResponse.error) throw businessResponse.error;

				// Verify the order belongs to the business
				if (businessResponse.data.id !== orderResponse.data.business_id) {
					throw new Error('Unauthorized to view this order');
				}

				if (mounted) {
					setOrder(orderResponse.data);
					setError(null);
				}
			} catch (err: any) {
				if (mounted) {
					setError(err.message);
					setOrder(null);
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		};

		fetchOrder();

		// Cleanup function to prevent setting state on unmounted component
		return () => {
			mounted = false;
		};
	}, [resolvedParams.orderId, router, supabase]);

	const updateOrderStatus = async (newStatus: OrderStatus) => {
		if (!resolvedParams.orderId) {
			setError('Order ID is required');
			return;
		}

		if (!order) {
			setError('Order not found');
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			// Verify business ownership again before update
			const { data: business } = await supabase
				.from('businesses')
				.select('id')
				.eq('owner_id', user.id)
				.single();

			if (!business || business.id !== order.business_id) {
				throw new Error('Unauthorized to update this order');
			}

			// Start a database transaction by wrapping updates
			const updates: Promise<any>[] = [];

			// Update order status
			updates.push(
				supabase
					.from('orders')
					.update({
						status: newStatus,
						updated_at: new Date().toISOString(),
					})
					.eq('id', resolvedParams.orderId)
			);

			// If order is confirmed and has a delivery, update delivery status to pending
			if (newStatus === 'confirmed' && order.delivery?.id) {
				updates.push(
					supabase
						.from('deliveries')
						.update({
							status: 'pending',
							updated_at: new Date().toISOString(),
						})
						.eq('id', order.delivery.id)
				);
			}

			// Execute all updates
			const results = await Promise.all(updates);

			// Check for errors in any of the updates
			const errors = results.filter((result) => result.error);
			if (errors.length > 0) {
				throw new Error(errors[0].error.message);
			}

			// Update local state
			setOrder((prev) => {
				if (!prev) return null;
				return {
					...prev,
					status: newStatus,
					delivery:
						newStatus === 'confirmed' && prev.delivery
							? { ...prev.delivery, status: 'pending' }
							: prev.delivery,
				};
			});

			router.refresh();
		} catch (error: any) {
			setError(error.message);
			// On error, refresh the page to ensure consistent state
			router.refresh();
		} finally {
			setLoading(false);
		}
	};

	// Show loading spinner while fetching data
	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<Card>
						<CardContent>
							<LoadingSpinner />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Show error state
	if (error || !order) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<Card>
						<CardContent className="p-8">
							<div className="text-center">
								<h2 className="text-xl font-semibold text-red-600 mb-2">
									Error
								</h2>
								<p className="text-gray-600">{error || 'Order not found'}</p>
								<Button
									className="mt-4"
									onClick={() => router.push('/dashboard/business/orders')}
								>
									Back to Orders
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Format the delivery status text
	const formatDeliveryStatus = (status?: string) => {
		if (!status) return 'N/A';
		return status.replace(/_/g, ' ').toUpperCase();
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">Order Details</h1>
					<p className="text-gray-600">
						Order #{resolvedParams.orderId.slice(0, 8)}
					</p>
				</div>

				<div className="space-y-6">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Order Status</CardTitle>
									<CardDescription>
										{format(
											new Date(order.created_at),
											"MMM dd, yyyy 'at' hh:mm a"
										)}
									</CardDescription>
								</div>
								<Badge
									variant={
										order.status === 'completed'
											? 'default'
											: order.status === 'pending'
											? 'secondary'
											: order.status === 'confirmed'
											? 'outline'
											: order.status === 'cancelled'
											? 'destructive'
											: 'secondary'
									}
								>
									{order.status.toUpperCase()}
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center space-x-4">
									<Select
										value={order.status}
										onValueChange={(value) =>
											updateOrderStatus(value as OrderStatus)
										}
										disabled={
											loading ||
											['completed', 'cancelled'].includes(order.status)
										}
									>
										<SelectTrigger className="w-[180px]">
											<SelectValue placeholder="Select status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="pending">Pending</SelectItem>
											<SelectItem value="confirmed">Confirm Order</SelectItem>
											<SelectItem value="completed">
												Mark as Completed
											</SelectItem>
											<SelectItem value="cancelled">Cancel Order</SelectItem>
										</SelectContent>
									</Select>

									<p className="text-sm text-gray-500">
										{loading ? 'Updating...' : 'Change order status'}
									</p>
								</div>

								{order.delivery?.[0] && (
									<div className="mt-4">
										<p className="text-sm font-medium mb-1">Delivery Status</p>
										<Badge variant="outline">
											{formatDeliveryStatus(order.delivery[0].status)}
										</Badge>
										{order.delivery[0].transport_service && (
											<p className="text-sm text-gray-600 mt-2">
												Driver:{' '}
												{order.delivery[0].transport_service.service_name} (
												{order.delivery[0].transport_service.phone})
											</p>
										)}
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Order Details</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								<div>
									<h4 className="font-medium mb-2">Items</h4>
									<div className="space-y-2">
										{order.order_items?.map((item) => (
											<div
												key={item.id}
												className="flex justify-between text-sm"
											>
												<span>
													{item.quantity}x {item.item?.name}
												</span>
												<span>
													{formatXAF(item.quantity * (item.item?.price || 0))}
												</span>
											</div>
										))}
									</div>
									<Separator className="my-4" />
									<div className="flex justify-between font-medium">
										<span>Total</span>
										<span>{formatXAF(order.total_amount)}</span>
									</div>
								</div>

								<div>
									<h4 className="font-medium mb-2">Delivery Information</h4>
									<p className="text-sm text-gray-600">
										{order.delivery_address}
									</p>
									{order.delivery_phone && (
										<p className="text-sm text-gray-600 mt-1">
											Phone: {order.delivery_phone}
										</p>
									)}
									{order.delivery_notes && (
										<p className="text-sm text-gray-600 mt-1">
											Notes: {order.delivery_notes}
										</p>
									)}
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
