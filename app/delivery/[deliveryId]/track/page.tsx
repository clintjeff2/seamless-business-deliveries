'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map } from '@/components/ui/map';
import { MapPin, Phone, Package, Truck, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { DeliveryStatus } from '@/lib/types';

interface DeliveryWithDetails {
	id: string;
	status: DeliveryStatus;
	current_latitude?: number;
	current_longitude?: number;
	delivery_latitude?: number;
	delivery_longitude?: number;
	delivery_address: string;
	estimated_delivery_time?: string;
	distance_km?: number;
	orders?: {
		id: string;
		business?: {
			name: string;
		};
	};
	transport_service?: {
		service_name: string;
		vehicle_type: string;
		phone?: string;
		driver?: {
			full_name: string;
			phone?: string;
		};
	};
}

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

export default function DeliveryTrackingPage() {
	const params = useParams();
	const deliveryId = params.deliveryId as string;
	const [delivery, setDelivery] = useState<DeliveryWithDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const supabase = createClient();

	useEffect(() => {
		let mounted = true;

		const fetchDelivery = async () => {
			try {
				const { data, error } = await supabase
					.from('deliveries')
					.select(
						`
						*,
						orders(
							id,
							business:businesses(name)
						),
						transport_service:transport_services(
							service_name,
							vehicle_type,
							phone,
							driver:profiles(full_name, phone)
						)
					`
					)
					.eq('id', deliveryId)
					.single();

				if (error) throw error;
				if (mounted) {
					setDelivery(data);
					setError(null);
				}
			} catch (error: any) {
				if (mounted) {
					setError(error.message);
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		};

		fetchDelivery();

		// Set up real-time subscription for delivery updates
		const deliveryChannel = supabase
			.channel(`delivery-${deliveryId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'deliveries',
					filter: `id=eq.${deliveryId}`,
				},
				(payload: { new: DeliveryWithDetails }) => {
					if (mounted) {
						setDelivery((prev) => {
							if (!prev) return null;
							return { ...prev, ...payload.new };
						});
					}
				}
			)
			.subscribe();

		return () => {
			mounted = false;
			deliveryChannel.unsubscribe();
		};
	}, [deliveryId, supabase]);

	// Show loading spinner
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

	// Show error state
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

	// Get status step from delivery status
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

	// Get map center coordinates with proper fallback
	const mapCenter: [number, number] =
		delivery?.current_latitude && delivery?.current_longitude
			? [delivery.current_longitude, delivery.current_latitude]
			: delivery?.delivery_latitude && delivery?.delivery_longitude
			? [delivery.delivery_longitude, delivery.delivery_latitude]
			: [-74.006, 40.7128]; // Default to NYC if no coordinates available

	// Define map markers with proper types
	const mapMarkers = [
		...(delivery?.current_latitude && delivery?.current_longitude
			? [
					{
						position: [
							delivery.current_longitude,
							delivery.current_latitude,
						] as [number, number],
						title: 'Current Location',
						color: '#3B82F6', // Blue
					},
			  ]
			: []),
		...(delivery?.delivery_latitude && delivery?.delivery_longitude
			? [
					{
						position: [
							delivery.delivery_longitude,
							delivery.delivery_latitude,
						] as [number, number],
						title: 'Delivery Address',
						color: '#EF4444', // Red
					},
			  ]
			: []),
	];

	return (
		<div className="min-h-screen flex flex-col">
			{/* Large Map Section */}
			<div className="h-[60vh] relative">
				<Map
					center={mapCenter}
					markers={mapMarkers}
					className="w-full h-full"
					showLiveLocation={true}
				/>
				<div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
					<div className="space-y-2">
						<div className="flex items-center text-sm">
							<div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
							<span>Current Location</span>
						</div>
						<div className="flex items-center text-sm">
							<div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
							<span>Delivery Destination</span>
						</div>
					</div>
				</div>
			</div>

			{/* Delivery Info Section */}
			<div className="flex-1 bg-gray-50">
				<div className="container mx-auto px-4 py-6">
					<div className="max-w-5xl mx-auto">
						{/* Header with basic info */}
						<div className="mb-6">
							<h1 className="text-2xl font-bold mb-2 flex items-center">
								<MapPin className="h-5 w-5 mr-2" />
								Track Your Delivery
							</h1>
							<p className="text-gray-600">
								Order #{delivery.orders?.id?.slice(0, 8)} from{' '}
								{delivery.orders?.business?.name}
							</p>
						</div>

						<div className="grid md:grid-cols-3 gap-6">
							{/* Status Timeline */}
							<div className="md:col-span-2">
								<Card>
									<CardHeader className="pb-4">
										<div className="flex items-center justify-between">
											<CardTitle>Delivery Status</CardTitle>
											<Badge
												variant={
													delivery.status === 'delivered'
														? 'default'
														: 'secondary'
												}
												className="ml-2"
											>
												{delivery.status.replace('_', ' ').toUpperCase()}
											</Badge>
										</div>
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
							</div>

							{/* Driver Info and Details */}
							<div className="space-y-6">
								{delivery.transport_service && (
									<Card>
										<CardHeader>
											<CardTitle className="text-lg">Driver Info</CardTitle>
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
														className="w-full"
													>
														<Phone className="h-4 w-4 mr-2" />
														{delivery.transport_service.phone}
													</Button>
												)}
											</div>
										</CardContent>
									</Card>
								)}

								<Card>
									<CardHeader>
										<CardTitle className="text-lg">Delivery Details</CardTitle>
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
														{format(
															new Date(delivery.estimated_delivery_time),
															"MMM d, yyyy 'at' h:mm a"
														)}
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
										</div>
									</CardContent>
								</Card>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
