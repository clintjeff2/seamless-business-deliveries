'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map } from '@/components/ui/map';
import { DeliveryChat } from '@/components/ui/delivery-chat';
import { FloatingChat } from '@/components/ui/floating-chat';
import Link from 'next/link';
import {
	MapPin,
	Phone,
	Navigation,
	MessageCircle,
	ArrowLeft,
	Clock,
	Battery,
	Signal,
	AlertTriangle,
	Truck,
	Target,
	CheckCircle,
	ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import type { DeliveryStatus } from '@/lib/types';

interface DeliveryWithDetails {
	id: string;
	status: DeliveryStatus;
	delivery_address: string;
	delivery_latitude: number;
	delivery_longitude: number;
	current_latitude?: number;
	current_longitude?: number;
	estimated_delivery_time?: string;
	delivery_fee: number;
	original_distance_km?: number;
	orders?: {
		id: string;
		user_id: string;
		business: {
			name: string;
		};
		customer: {
			full_name: string;
			phone: string;
		};
	};
	transport_service?: {
		id: string;
		service_name: string;
		vehicle_type: string;
		phone: string;
		driver: {
			full_name: string;
			phone: string;
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

export default function DeliveryNavigationPage() {
	const params = useParams();
	const router = useRouter();
	const deliveryId = params.deliveryId as string;
	const [delivery, setDelivery] = useState<DeliveryWithDetails | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
	const [estimatedArrival, setEstimatedArrival] = useState<Date | null>(null);
	const [trafficDelay, setTrafficDelay] = useState<number>(0);
	const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
	const [locationUpdateInterval, setLocationUpdateInterval] =
		useState<NodeJS.Timeout | null>(null);
	const [driverStatus, setDriverStatus] = useState<
		'online' | 'offline' | 'away'
	>('online');
	const [showChat, setShowChat] = useState(false);
	const [isChatMinimized, setIsChatMinimized] = useState(false);
	const [currentUser, setCurrentUser] = useState<any>(null);
	const supabase = createClient();

	// Get current user
	useEffect(() => {
		const getCurrentUser = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setCurrentUser(user);
		};
		getCurrentUser();
	}, [supabase]);

	// Fetch delivery details
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
			.channel(`delivery-navigation-${deliveryId}`)
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

	// Update delivery status
	const updateDeliveryStatus = async (newStatus: DeliveryStatus) => {
		if (!delivery) return;

		try {
			const updates: any = {
				status: newStatus,
				updated_at: new Date().toISOString(),
			};

			// If starting transit, get current location and update it
			if (newStatus === 'in_transit') {
				if (navigator.geolocation) {
					const position = await new Promise<GeolocationPosition>(
						(resolve, reject) => {
							navigator.geolocation.getCurrentPosition(resolve, reject, {
								enableHighAccuracy: true,
								timeout: 10000,
								maximumAge: 30000,
							});
						}
					);

					updates.current_latitude = position.coords.latitude;
					updates.current_longitude = position.coords.longitude;
				}
			}

			const { error } = await supabase
				.from('deliveries')
				.update(updates)
				.eq('id', deliveryId);

			if (error) throw error;

			setDelivery((prev) => {
				if (!prev) return null;
				return { ...prev, ...updates };
			});
		} catch (error: any) {
			console.error('Error updating delivery status:', error);
		}
	};

	// Real-time location tracking for drivers
	useEffect(() => {
		if (!delivery || delivery.status !== 'in_transit') return;

		const updateDriverLocation = async (position: GeolocationPosition) => {
			try {
				const { error } = await supabase
					.from('deliveries')
					.update({
						current_latitude: position.coords.latitude,
						current_longitude: position.coords.longitude,
						updated_at: new Date().toISOString(),
					})
					.eq('id', deliveryId);

				if (error) throw error;

				// Update local state
				setDelivery((prev) => {
					if (!prev) return null;
					return {
						...prev,
						current_latitude: position.coords.latitude,
						current_longitude: position.coords.longitude,
					};
				});
			} catch (error) {
				console.error('Error updating driver location:', error);
			}
		};

		let watchId: number | null = null;

		if (navigator.geolocation) {
			watchId = navigator.geolocation.watchPosition(
				updateDriverLocation,
				(error) => console.error('Geolocation error:', error),
				{
					enableHighAccuracy: true,
					maximumAge: 10000, // 10 seconds
					timeout: 15000,
				}
			);
		}

		return () => {
			if (watchId !== null) {
				navigator.geolocation.clearWatch(watchId);
			}
		};
	}, [delivery?.status, deliveryId, supabase]);

	// Format time remaining
	const formatTimeRemaining = (seconds: number): string => {
		if (!seconds || seconds <= 0) return 'Calculating...';
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	};

	// Format distance
	const formatDistance = (distanceKm: number): string => {
		if (!distanceKm || distanceKm <= 0) return 'N/A';
		return `${distanceKm.toFixed(1)} km`;
	};

	// Show loading spinner
	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	// Show error state
	if (error || !delivery) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
				<Card className="max-w-md w-full">
					<CardContent className="p-6 text-center">
						<AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
						<h2 className="text-xl font-semibold mb-2">Navigation Error</h2>
						<p className="text-gray-600 mb-4">
							{error || "The delivery you're looking for doesn't exist."}
						</p>
						<Button onClick={() => router.push('/dashboard/transport')}>
							Back to Dashboard
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Get map center coordinates
	const mapCenter: [number, number] =
		delivery?.current_latitude && delivery?.current_longitude
			? [delivery.current_longitude, delivery.current_latitude]
			: delivery?.delivery_latitude && delivery?.delivery_longitude
			? [delivery.delivery_longitude, delivery.delivery_latitude]
			: [11.5174, 3.848]; // Default to Yaoundé, Cameroon

	// Define destination for routing
	const destination: [number, number] | undefined =
		delivery?.delivery_latitude && delivery?.delivery_longitude
			? [delivery.delivery_longitude, delivery.delivery_latitude]
			: undefined;

	// Define map markers
	const mapMarkers = [
		...(delivery?.current_latitude && delivery?.current_longitude
			? [
					{
						position: [
							delivery.current_longitude,
							delivery.current_latitude,
						] as [number, number],
						title: 'Your Current Location',
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
			picked_up: 'Start Navigation',
			in_transit: 'Complete Delivery',
			delivered: 'Completed',
			cancelled: 'Cancelled',
		};
		return actions[status];
	};

	return (
		<div className="h-screen flex flex-col lg:flex-row bg-gray-100 dark:bg-gray-900">
			{/* Header */}
			<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => router.push('/dashboard/transport')}
						>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Dashboard
						</Button>
						<div>
							<h1 className="text-lg font-semibold dark:text-white">
								Navigation Mode
							</h1>
							<p className="text-sm text-gray-600 dark:text-gray-400">
								Order #{delivery.orders?.id?.slice(0, 8)} •{' '}
								{delivery.orders?.business?.name}
							</p>
						</div>
					</div>
					<div className="flex items-center space-x-2">
						<Badge
							variant={
								delivery.status === 'delivered' ? 'default' : 'secondary'
							}
							className="capitalize"
						>
							{delivery.status.replace('_', ' ')}
						</Badge>
						<div className="flex items-center space-x-1">
							<Signal className="h-4 w-4 text-green-500" />
							<Battery className="h-4 w-4 text-green-500" />
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 flex flex-col lg:flex-row">
				{/* Map Section */}
				<div className="flex-1 relative">
					<Map
						center={mapCenter}
						markers={mapMarkers}
						className="w-full h-[60vh] lg:h-full"
						showLiveLocation={true}
						destination={destination}
						onRouteUpdate={handleRouteUpdate}
						driverLocation={
							delivery?.current_latitude && delivery?.current_longitude
								? [delivery.current_longitude, delivery.current_latitude]
								: null
						}
					/>

					{/* Floating Route Info */}
					{routeInfo && (
						<div className="absolute top-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-4 rounded-lg shadow-lg min-w-[250px]">
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium dark:text-white">
										ETA:
									</span>
									<span className="text-lg font-bold text-green-600 dark:text-green-400">
										{formatTimeRemaining(routeInfo.durationInTraffic)}
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium dark:text-white">
										Distance:
									</span>
									<span className="text-sm font-bold dark:text-white">
										{(routeInfo.distance / 1000).toFixed(1)} km
									</span>
								</div>
								{trafficDelay > 60 && (
									<div className="flex items-center justify-between">
										<span className="text-sm text-orange-600 dark:text-orange-400">
											Traffic Delay:
										</span>
										<span className="text-sm font-bold text-orange-600 dark:text-orange-400">
											+{formatTimeRemaining(trafficDelay)}
										</span>
									</div>
								)}
								{estimatedArrival && (
									<div className="text-center pt-2 border-t">
										<p className="text-xs text-gray-600 dark:text-gray-400">
											Arriving at
										</p>
										<p className="font-bold dark:text-white">
											{format(estimatedArrival, 'h:mm a')}
										</p>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Controls Panel */}
				<div className="w-full lg:w-80 bg-white dark:bg-gray-800 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 p-4 space-y-4">
					{/* Delivery Status */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">Delivery Status</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm text-gray-600 dark:text-gray-400">
									Current:
								</span>
								<Badge variant="outline" className="capitalize">
									{delivery.status.replace('_', ' ')}
								</Badge>
							</div>

							{getNextStatus(delivery.status) && (
								<Button
									onClick={() =>
										updateDeliveryStatus(getNextStatus(delivery.status)!)
									}
									className="w-full"
									size="sm"
								>
									{getActionButtonText(delivery.status)}
								</Button>
							)}
						</CardContent>
					</Card>

					{/* Customer Info */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">Customer Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div>
								<p className="text-sm font-medium dark:text-white">
									{delivery.orders?.customer.full_name}
								</p>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									{delivery.orders?.customer.phone}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium dark:text-white mb-1">
									Delivery Address:
								</p>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									{delivery.delivery_address}
								</p>
							</div>
							<div className="flex space-x-2">
								<Button
									variant="outline"
									size="sm"
									className="flex-1"
									onClick={() =>
										window.open(`tel:${delivery.orders?.customer.phone}`)
									}
								>
									<Phone className="h-4 w-4 mr-2" />
									Call
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="flex-1"
									onClick={() => setShowChat(true)}
								>
									<MessageCircle className="h-4 w-4 mr-2" />
									Chat
								</Button>
							</div>
							<Button asChild variant="outline" size="sm" className="w-full">
								<Link href="/chats">
									<MessageCircle className="h-4 w-4 mr-2" />
									View All Chats
									<ExternalLink className="h-4 w-4 ml-2" />
								</Link>
							</Button>
						</CardContent>
					</Card>

					{/* Navigation Controls */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<Button
								variant="outline"
								className="w-full"
								onClick={() => {
									const destination = `${delivery.delivery_latitude},${delivery.delivery_longitude}`;
									window.open(
										`https://www.google.com/maps/dir/?api=1&destination=${destination}`
									);
								}}
							>
								<Navigation className="h-4 w-4 mr-2" />
								Open in Google Maps
							</Button>
							<Button
								variant="outline"
								className="w-full"
								onClick={() => {
									const destination = `${delivery.delivery_latitude},${delivery.delivery_longitude}`;
									window.open(
										`https://waze.com/ul?ll=${destination}&navigate=yes`
									);
								}}
							>
								<Target className="h-4 w-4 mr-2" />
								Open in Waze
							</Button>
						</CardContent>
					</Card>

					{/* Progress Indicator */}
					{delivery.original_distance_km && routeInfo && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">Journey Progress</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span>Progress</span>
										<span>
											{Math.max(
												0,
												Math.min(
													100,
													((delivery.original_distance_km -
														routeInfo.distance / 1000) /
														delivery.original_distance_km) *
														100
												)
											).toFixed(0)}
											%
										</span>
									</div>
									<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
										<div
											className="bg-blue-500 h-2 rounded-full transition-all duration-500"
											style={{
												width: `${Math.max(
													0,
													Math.min(
														100,
														((delivery.original_distance_km -
															routeInfo.distance / 1000) /
															delivery.original_distance_km) *
															100
													)
												)}%`,
											}}
										></div>
									</div>
									<div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
										<span>Started</span>
										<span>Destination</span>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

			{/* Enhanced Floating Chat for Driver */}
			{currentUser && delivery && (
				<FloatingChat
					deliveryId={deliveryId}
					currentUserId={currentUser.id}
					userType="driver"
					otherUserPhone={delivery.orders?.customer?.phone}
					className="bottom-6 right-6 lg:bottom-6 lg:right-80"
				/>
			)}
		</div>
	);
}
