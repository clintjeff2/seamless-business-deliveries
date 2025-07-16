'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map } from '@/components/ui/map'; // Your enhanced map component
import { DeliveryChat } from '@/components/ui/delivery-chat';
import { FloatingChat } from '@/components/ui/floating-chat';
import Link from 'next/link';
import {
	MapPin,
	Phone,
	Package,
	Truck,
	CheckCircle,
	Clock,
	Navigation,
	AlertTriangle,
	Battery,
	Signal,
	MessageCircle,
	ExternalLink,
} from 'lucide-react';
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
	original_distance_km?: number;
	orders?: {
		id: string;
		user_id: string;
		business?: {
			name: string;
		};
		customer?: {
			full_name: string;
			phone: string;
		};
	};
	transport_service?: {
		id: string;
		service_name: string;
		vehicle_type: string;
		phone?: string;
		driver_id?: string;
		driver?: {
			full_name: string;
			phone?: string;
		};
	};
}

interface RouteInfo {
	distance: number;
	duration: number;
	durationInTraffic: number;
	geometry: any;
	steps: any[];
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
	const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
	const [estimatedArrival, setEstimatedArrival] = useState<Date | null>(null);
	const [trafficDelay, setTrafficDelay] = useState<number>(0);
	const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
	const [driverStatus, setDriverStatus] = useState<
		'online' | 'offline' | 'away'
	>('online');
	const [showChat, setShowChat] = useState(false);
	const [isChatMinimized, setIsChatMinimized] = useState(false);
	const [currentUser, setCurrentUser] = useState<any>(null);
	const supabase = createClient();

	// Get current user and determine user type
	useEffect(() => {
		const getCurrentUser = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setCurrentUser(user);
		};
		getCurrentUser();
	}, [supabase]);

	// Determine user type (customer vs driver) - improved logic
	const getUserType = (): 'customer' | 'driver' => {
		if (!currentUser || !delivery) return 'customer';

		// Check if current user is the driver for this delivery
		if (delivery.transport_service?.driver_id && currentUser.id) {
			const isDriver = delivery.transport_service.driver_id === currentUser.id;
			return isDriver ? 'driver' : 'customer';
		}

		// Check if current user is the customer for this delivery
		if (delivery.orders?.user_id && currentUser.id) {
			const isCustomer = delivery.orders.user_id === currentUser.id;
			return isCustomer ? 'customer' : 'driver';
		}

		// Default to customer
		return 'customer';
	};

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
              user_id,
              business:businesses(name),
              customer:profiles!orders_user_id_fkey(full_name, phone)
            ),
            transport_service:transport_services(
              id,
              service_name,
              vehicle_type,
              phone,
              driver_id,
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

	// Handle route updates from the map
	const handleRouteUpdate = (newRouteInfo: RouteInfo) => {
		setRouteInfo(newRouteInfo);

		// Calculate estimated arrival time
		const now = new Date();
		const arrivalTime = new Date(
			now.getTime() + newRouteInfo.durationInTraffic * 1000
		);
		setEstimatedArrival(arrivalTime);

		// Calculate traffic delay
		const delay = newRouteInfo.durationInTraffic - newRouteInfo.duration;
		setTrafficDelay(delay);
	};

	// Simulate driver status updates
	useEffect(() => {
		const interval = setInterval(() => {
			const statuses: ('online' | 'offline' | 'away')[] = ['online', 'away'];
			setDriverStatus(statuses[Math.floor(Math.random() * statuses.length)]);
		}, 30000); // Update every 30 seconds

		return () => clearInterval(interval);
	}, []);

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

	// Get map center coordinates with proper fallback to Cameroon
	const mapCenter: [number, number] =
		delivery?.current_latitude && delivery?.current_longitude
			? [delivery.current_longitude, delivery.current_latitude]
			: delivery?.delivery_latitude && delivery?.delivery_longitude
			? [delivery.delivery_longitude, delivery.delivery_latitude]
			: [11.5174, 3.848]; // Default to Yaoundé, Cameroon if no coordinates available

	// Define destination for routing
	const destination: [number, number] | undefined =
		delivery?.delivery_latitude && delivery?.delivery_longitude
			? [delivery.delivery_longitude, delivery.delivery_latitude]
			: undefined;

	// Define map markers with proper types
	const mapMarkers = [
		...(delivery?.current_latitude && delivery?.current_longitude
			? [
					{
						position: [
							delivery.current_longitude,
							delivery.current_latitude,
						] as [number, number],
						title: 'Driver Current Location',
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
						title: 'Delivery Destination',
						color: '#EF4444', // Red
					},
			  ]
			: []),
	];

	// Debug logging for coordinates
	console.log('Delivery data:', {
		delivery_latitude: delivery?.delivery_latitude,
		delivery_longitude: delivery?.delivery_longitude,
		current_latitude: delivery?.current_latitude,
		current_longitude: delivery?.current_longitude,
	});
	console.log('Map markers being passed:', mapMarkers);
	console.log('Map center:', mapCenter);
	console.log('Destination:', destination);

	// Format time remaining
	const formatTimeRemaining = (seconds: number): string => {
		if (!seconds || seconds <= 0) return 'Calculating...';
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	};

	// Calculate progress percentage
	const calculateProgress = (): number => {
		if (
			!delivery.original_distance_km ||
			!routeInfo ||
			delivery.original_distance_km <= 0
		)
			return 0;
		const remainingDistance = routeInfo.distance / 1000; // Convert to km
		const traveledDistance = delivery.original_distance_km - remainingDistance;
		return Math.max(
			0,
			Math.min(100, (traveledDistance / delivery.original_distance_km) * 100)
		);
	};

	// Format distance display
	const formatDistance = (distanceKm: number): string => {
		if (!distanceKm || distanceKm <= 0) return 'N/A';
		return `${distanceKm.toFixed(1)} km`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
			{/* Enhanced Map Section - Mobile responsive */}
			<div className="h-[50vh] sm:h-[60vh] lg:h-[65vh] relative">
				<Map
					center={mapCenter}
					markers={mapMarkers}
					className="w-full h-full"
					showLiveLocation={true}
					destination={destination}
					onRouteUpdate={handleRouteUpdate}
					driverLocation={
						delivery?.current_latitude && delivery?.current_longitude
							? [delivery.current_longitude, delivery.current_latitude]
							: null
					}
				/>

				{/* Driver Status Overlay - repositioned for mobile */}
				<div className="absolute bottom-4 left-4 sm:bottom-4 sm:right-4 space-y-2">
					<div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-1.5 sm:p-2 rounded-md shadow-lg">
						<div className="flex items-center space-x-1.5">
							<div
								className={`w-1.5 h-1.5 rounded-full ${
									driverStatus === 'online'
										? 'bg-green-500 animate-pulse'
										: driverStatus === 'away'
										? 'bg-yellow-500'
										: 'bg-red-500'
								}`}
							></div>
							<span className="text-xs font-medium capitalize dark:text-white">
								{delivery?.transport_service?.service_name || 'Driver'} -{' '}
								{driverStatus}
							</span>
						</div>
					</div>

					{/* Mobile-friendly delivery status indicator */}
					<div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-1.5 sm:p-2 rounded-md shadow-lg">
						<div className="flex items-center space-x-1.5">
							<Truck className="h-3 w-3 text-blue-500" />
							<span className="text-xs font-medium dark:text-white capitalize">
								{delivery.status.replace('_', ' ')}
							</span>
						</div>
					</div>

					{/* Compact Route Information Overlay */}
					{routeInfo && (
						<div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-2 rounded-md shadow-lg">
							<div className="grid grid-cols-2 gap-2 text-xs">
								<div className="text-center">
									<div className="font-bold text-blue-600 dark:text-blue-400">
										{(routeInfo.distance / 1000).toFixed(1)}km
									</div>
									<div className="text-gray-600 dark:text-gray-400 text-xs">
										Distance
									</div>
								</div>
								<div className="text-center">
									<div className="font-bold text-green-600 dark:text-green-400">
										{formatTimeRemaining(routeInfo.durationInTraffic)}
									</div>
									<div className="text-gray-600 dark:text-gray-400 text-xs">
										ETA
									</div>
								</div>
								{trafficDelay > 60 && (
									<div className="text-center col-span-1">
										<div className="font-bold text-orange-600 dark:text-orange-400">
											+{formatTimeRemaining(trafficDelay)}
										</div>
										<div className="text-gray-600 dark:text-gray-400 text-xs">
											Traffic
										</div>
									</div>
								)}
								{estimatedArrival && (
									<div className="text-center col-span-1">
										<div className="font-bold text-purple-600 dark:text-purple-400">
											{format(estimatedArrival, 'h:mm a')}
										</div>
										<div className="text-gray-600 dark:text-gray-400 text-xs">
											Arrival
										</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Route Calculation Indicator */}
				{!routeInfo &&
					delivery?.current_latitude &&
					delivery?.current_longitude &&
					delivery?.delivery_latitude &&
					delivery?.delivery_longitude && (
						<div className="absolute top-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-lg shadow-lg">
							<div className="flex items-center space-x-2">
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
								<span className="text-sm font-medium dark:text-white">
									Calculating route...
								</span>
							</div>
						</div>
					)}
			</div>

			{/* Content Section - Mobile responsive layout */}
			<div className="flex-1 bg-white dark:bg-gray-800">
				<div className="container mx-auto px-4 py-4 sm:py-6">
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
						{/* Main Content */}
						<div className="lg:col-span-2 space-y-4 sm:space-y-6">
							{/* Delivery Progress - Mobile optimized */}
							<Card>
								<CardHeader className="pb-3 sm:pb-4">
									<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
										<div>
											<CardTitle className="text-lg sm:text-xl dark:text-white">
												Delivery Progress
											</CardTitle>
											<CardDescription className="text-sm">
												Track your order in real-time
											</CardDescription>
										</div>
										<Badge
											variant={
												delivery.status === 'delivered'
													? 'default'
													: 'secondary'
											}
											className="self-start sm:self-center text-xs sm:text-sm"
										>
											{delivery.status.replace('_', ' ').toUpperCase()}
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<div className="space-y-3 sm:space-y-4">
										{deliverySteps.map((step) => (
											<div
												key={step.step}
												className={`flex items-start space-x-3 sm:space-x-4 p-3 sm:p-4 rounded-lg border ${
													step.step <= currentStep
														? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
														: 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
												}`}
											>
												<div
													className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
														step.step <= currentStep
															? 'bg-green-500 text-white'
															: 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-400'
													}`}
												>
													{step.step <= currentStep ? (
														<CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
													) : (
														<step.icon className="h-3 w-3 sm:h-4 sm:w-4" />
													)}
												</div>
												<div className="flex-1 min-w-0">
													<p
														className={`font-medium text-sm sm:text-base ${
															step.step <= currentStep
																? 'text-green-600 dark:text-green-400'
																: 'text-gray-400 dark:text-gray-500'
														}`}
													>
														{step.label}
													</p>
													<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
														{step.desc}
													</p>
													{step.step === currentStep && (
														<div className="mt-2 flex items-center space-x-2">
															<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
															<span className="text-xs text-green-600 dark:text-green-400 font-medium">
																Current Status
															</span>
														</div>
													)}
												</div>
												{step.step <= currentStep && (
													<CheckCircle className="h-4 w-4 sm:h-6 sm:w-6 text-green-500 flex-shrink-0" />
												)}
											</div>
										))}
									</div>
								</CardContent>
							</Card>

							{/* Route Information - Mobile responsive */}
							{routeInfo && (
								<Card>
									<CardHeader>
										<CardTitle className="text-lg sm:text-xl flex items-center dark:text-white">
											<Navigation className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
											Route Information
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
											<div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
												<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
													Distance
												</p>
												<p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
													{(routeInfo.distance / 1000).toFixed(1)} km
												</p>
											</div>
											<div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
												<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
													ETA
												</p>
												<p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
													{Math.ceil(routeInfo.durationInTraffic / 60)} min
												</p>
											</div>
											<div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
												<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
													Traffic
												</p>
												<p className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400">
													+
													{Math.ceil(
														(routeInfo.durationInTraffic - routeInfo.duration) /
															60
													)}{' '}
													min
												</p>
											</div>
											<div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
												<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
													Arrival
												</p>
												<p className="text-sm sm:text-base font-bold text-purple-600 dark:text-purple-400">
													{estimatedArrival
														? format(estimatedArrival, 'h:mm a')
														: 'Calculating...'}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Enhanced Delivery Details - Mobile responsive */}
							<Card>
								<CardHeader>
									<CardTitle className="text-lg sm:text-xl flex items-center dark:text-white">
										<Package className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
										Delivery Details
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div>
											<p className="font-semibold text-sm sm:text-base dark:text-white">
												Delivery Address
											</p>
											<p className="text-sm text-gray-600 dark:text-gray-400">
												{delivery.delivery_address}
											</p>
										</div>

										{estimatedArrival && (
											<div>
												<p className="font-semibold text-sm sm:text-base dark:text-white">
													Estimated Arrival
												</p>
												<p className="text-sm text-gray-600 dark:text-gray-400">
													{format(
														estimatedArrival,
														"EEEE, MMMM do 'at' h:mm a"
													)}
												</p>
											</div>
										)}

										{delivery.orders && (
											<div>
												<p className="font-semibold text-sm sm:text-base dark:text-white mb-2">
													Order Summary
												</p>
												<div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
													<p className="text-sm dark:text-white">
														<strong>From:</strong>{' '}
														{delivery.orders.business?.name}
													</p>
													<p className="text-sm text-gray-600 dark:text-gray-400">
														Customer: {delivery.orders.customer?.full_name}
													</p>
												</div>
											</div>
										)}

										{routeInfo && delivery.original_distance_km && (
											<div>
												<p className="font-semibold text-sm sm:text-base dark:text-white">
													Distance Information
												</p>
												<div className="grid grid-cols-2 gap-3 mt-2">
													<div>
														<p className="text-xs text-gray-600 dark:text-gray-400">
															Remaining
														</p>
														<p className="text-sm font-medium dark:text-white">
															{(routeInfo.distance / 1000).toFixed(1)} km
														</p>
													</div>
													<div>
														<p className="text-xs text-gray-600 dark:text-gray-400">
															Original
														</p>
														<p className="text-sm font-medium dark:text-white">
															{delivery.original_distance_km} km
														</p>
													</div>
												</div>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Sidebar - Mobile responsive */}
						<div className="space-y-4 sm:space-y-6">
							{/* Driver Information - Mobile optimized */}
							{delivery.transport_service && (
								<Card>
									<CardHeader>
										<CardTitle className="text-lg flex items-center dark:text-white">
											<Truck className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
											Your Driver
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											<div>
												<p className="font-semibold text-sm sm:text-base dark:text-white">
													{delivery.transport_service.service_name}
												</p>
												<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 capitalize">
													{delivery.transport_service.vehicle_type}
												</p>
											</div>
											<div className="flex space-x-2">
												<Button
													variant="outline"
													size="sm"
													className="flex-1 text-xs sm:text-sm"
													onClick={() =>
														window.open(
															`tel:${delivery.transport_service?.phone}`
														)
													}
												>
													<Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
													Call
												</Button>
												<Button
													variant="outline"
													size="sm"
													className="flex-1 text-xs sm:text-sm"
													onClick={() =>
														window.open(
															`sms:${delivery.transport_service?.phone}`
														)
													}
												>
													<Package className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
													SMS
												</Button>
											</div>
											<Button
												asChild
												variant="outline"
												size="sm"
												className="w-full text-xs sm:text-sm"
											>
												<Link href="/chats">
													<MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
													View All Chats
													<ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
												</Link>
											</Button>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Live Updates - Mobile responsive */}
							<Card>
								<CardHeader>
									<CardTitle className="text-lg flex items-center dark:text-white">
										<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
										Live Updates
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div className="flex items-start space-x-3">
											<div className="w-2 h-2 bg-green-500 rounded-full mt-2 animate-pulse flex-shrink-0"></div>
											<div className="min-w-0">
												<p className="text-sm font-medium dark:text-white">
													GPS tracking active
												</p>
												<p className="text-xs text-gray-600 dark:text-gray-400">
													Real-time location updates
												</p>
											</div>
										</div>
										<div className="flex items-start space-x-3">
											<div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
											<div className="min-w-0">
												<p className="text-sm font-medium dark:text-white">
													Route optimized
												</p>
												<p className="text-xs text-gray-600 dark:text-gray-400">
													Following fastest route
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</div>

			{/* Enhanced Floating Chat - Mobile optimized */}
			{currentUser &&
				delivery &&
				delivery.status !== 'delivered' &&
				delivery.status !== 'cancelled' && (
					<FloatingChat
						deliveryId={deliveryId}
						currentUserId={currentUser.id}
						userType="customer"
						otherUserPhone={delivery.transport_service?.phone}
						className="bottom-4 right-4 sm:bottom-6 sm:right-6"
					/>
				)}
		</div>
	);
}
