'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map } from '@/components/ui/map';
import { MapPin, Phone, Package, Truck, CheckCircle } from 'lucide-react';
import type { DeliveryStatus } from '@/lib/types';

const deliverySteps = [
	{
		step: 1,
		status: 'pending',
		icon: Package,
		label: 'Order Confirmed',
		desc: 'Your order has been placed',
	},
	{
		step: 2,
		status: 'accepted',
		icon: CheckCircle,
		label: 'Driver Assigned',
		desc: 'A driver has accepted your delivery',
	},
	{
		step: 3,
		status: 'picked_up',
		icon: Package,
		label: 'Order Picked Up',
		desc: 'Driver has collected your order',
	},
	{
		step: 4,
		status: 'in_transit',
		icon: Truck,
		label: 'On the Way',
		desc: 'Your order is being delivered',
	},
	{
		step: 5,
		status: 'delivered',
		icon: CheckCircle,
		label: 'Delivered',
		desc: 'Order has been delivered',
	},
];

export default function TrackDeliveryPage({
	params,
}: {
	params: { deliveryId: string };
}) {
	const [delivery, setDelivery] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const supabase = createClient();

	useEffect(() => {
		const fetchDelivery = async () => {
			try {
				const { data, error } = await supabase
					.from('deliveries')
					.select(
						`
            *,
            order:orders(
              *,
              business:businesses(name, address, phone),
              order_items(
                *,
                item:items(name, price)
              )
            ),
            transport_service:transport_services(
              service_name,
              vehicle_type,
              phone,
              driver:profiles(full_name, phone)
            )
          `
					)
					.eq('id', params.deliveryId)
					.single();

				if (error) throw error;
				setDelivery(data);
			} catch (error: any) {
				setError(error.message);
			} finally {
				setLoading(false);
			}
		};

		fetchDelivery();

		// Set up real-time subscription for delivery updates
		const subscription = supabase
			.channel(`delivery-${params.deliveryId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'deliveries',
					filter: `id=eq.${params.deliveryId}`,
				},
				(payload) => {
					setDelivery((prev: any) => ({ ...prev, ...payload.new }));
				}
			)
			.subscribe();

		return () => {
			subscription.unsubscribe();
		};
	}, [params.deliveryId, supabase]);

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto">
					<div className="animate-pulse space-y-4">
						<div className="h-8 bg-gray-200 rounded w-1/3"></div>
						<div className="h-64 bg-gray-200 rounded"></div>
						<div className="h-32 bg-gray-200 rounded"></div>
					</div>
				</div>
			</div>
		);
	}

	if (error || !delivery) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl mx-auto text-center">
					<h1 className="text-2xl font-bold mb-4">Delivery Not Found</h1>
					<p className="text-gray-600">
						{error || "The delivery you're looking for doesn't exist."}
					</p>
				</div>
			</div>
		);
	}

	const getStatusStep = (status: DeliveryStatus): number => {
		const statusToStep: Record<DeliveryStatus, number> = {
			pending: 1,
			accepted: 2,
			picked_up: 3,
			in_transit: 4,
			delivered: 5,
			cancelled: 0,
		};
		return statusToStep[status] || 0;
	};

	const currentStep = getStatusStep(delivery.status);

	const mapCenter: [number, number] =
		delivery.current_latitude && delivery.current_longitude
			? [delivery.current_latitude, delivery.current_longitude]
			: [40.7128, -74.006]; // Default to NYC

	const mapMarkers = [
		{
			position: mapCenter,
			title: 'Current Location',
			color: 'blue',
		},
		...(delivery.delivery_latitude && delivery.delivery_longitude
			? [
					{
						position: [
							delivery.delivery_latitude,
							delivery.delivery_longitude,
						] as [number, number],
						title: 'Delivery Address',
						color: 'red',
					},
			  ]
			: []),
	];

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold mb-2">Track Your Delivery</h1>
					<p className="text-gray-600">
						Order #{delivery.order?.id?.slice(0, 8)} from{' '}
						{delivery.order?.business?.name}
					</p>
				</div>

				<div className="grid lg:grid-cols-2 gap-8">
					{/* Map Section */}
					<div>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<MapPin className="h-5 w-5 mr-2" />
									Live Location
								</CardTitle>
								<CardDescription>Real-time delivery tracking</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="h-64 rounded-lg overflow-hidden">
									<Map
										center={mapCenter}
										markers={mapMarkers}
										className="w-full h-full"
									/>
								</div>
								<div className="mt-4 space-y-2">
									<div className="flex items-center text-sm">
										<div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
										<span>Current Location</span>
									</div>
									<div className="flex items-center text-sm">
										<div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
										<span>Delivery Destination</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Delivery Status Section */}
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Delivery Status</CardTitle>
								<CardDescription>
									<Badge
										variant={
											delivery.status === 'delivered' ? 'default' : 'secondary'
										}
									>
										{delivery.status.replace('_', ' ').toUpperCase()}
									</Badge>
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{deliverySteps.map((step) => (
										<div
											key={step.step}
											className="flex items-center space-x-3"
										>
											<div
												className={`w-8 h-8 rounded-full flex items-center justify-center ${
													step.step <= currentStep
														? 'bg-green-100 text-green-600'
														: 'bg-gray-100 text-gray-400'
												}`}
											>
												<step.icon className="h-4 w-4" />
											</div>
											<div className="flex-1">
												<p
													className={`font-semibold ${
														step.step <= currentStep
															? 'text-green-600'
															: 'text-gray-400'
													}`}
												>
													{step.label}
												</p>
												<p className="text-sm text-gray-600">{step.desc}</p>
											</div>
											{step.step <= currentStep && (
												<CheckCircle className="h-5 w-5 text-green-500" />
											)}
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Driver Info */}
						{delivery.transport_service && (
							<Card>
								<CardHeader>
									<CardTitle>Driver Information</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div>
											<p className="font-semibold">
												{delivery.transport_service.service_name}
											</p>
											<p className="text-sm text-gray-600">
												{delivery.transport_service.vehicle_type}
											</p>
										</div>
										{delivery.transport_service.driver && (
											<div>
												<p className="font-semibold">
													{delivery.transport_service.driver.full_name}
												</p>
												<p className="text-sm text-gray-600">Driver</p>
											</div>
										)}
										{delivery.transport_service.phone && (
											<Button
												variant="outline"
												size="sm"
												className="w-full bg-transparent"
											>
												<Phone className="h-4 w-4 mr-2" />
												Call Driver: {delivery.transport_service.phone}
											</Button>
										)}
									</div>
								</CardContent>
							</Card>
						)}

						{/* Delivery Details */}
						<Card>
							<CardHeader>
								<CardTitle>Delivery Details</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div>
										<p className="font-semibold">Delivery Address</p>
										<p className="text-sm text-gray-600">
											{delivery.delivery_address}
										</p>
									</div>
									{delivery.estimated_delivery_time && (
										<div>
											<p className="font-semibold">Estimated Delivery</p>
											<p className="text-sm text-gray-600">
												{new Date(
													delivery.estimated_delivery_time
												).toLocaleString()}
											</p>
										</div>
									)}
									{delivery.distance_km && (
										<div>
											<p className="font-semibold">Distance</p>
											<p className="text-sm text-gray-600">
												{delivery.distance_km} km
											</p>
										</div>
									)}
									{delivery.delivery_fee && (
										<div>
											<p className="font-semibold">Delivery Fee</p>
											<p className="text-sm text-gray-600">
												${delivery.delivery_fee}
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Order Items */}
				<Card className="mt-8">
					<CardHeader>
						<CardTitle>Order Items</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{delivery.order?.order_items?.map((orderItem: any) => (
								<div
									key={orderItem.id}
									className="flex items-center justify-between"
								>
									<div>
										<p className="font-semibold">{orderItem.item?.name}</p>
										<p className="text-sm text-gray-600">
											Quantity: {orderItem.quantity}
										</p>
									</div>
									<p className="font-semibold">
										${(orderItem.price * orderItem.quantity).toFixed(2)}
									</p>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
