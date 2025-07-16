'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getCart, getCartTotal, clearCart } from '@/lib/cart';
import { MapPin, Truck, CreditCard, AlertTriangle } from 'lucide-react';
import type { CartItem, TransportService } from '@/lib/types';
import { geocodeAddress } from '@/lib/mapbox';

interface Business {
	id: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
}

export default function CheckoutPage() {
	const [cartItems, setCartItems] = useState<CartItem[]>([]);
	const [business, setBusiness] = useState<Business | null>(null);
	const [transportServices, setTransportServices] = useState<
		TransportService[]
	>([]);
	const [selectedTransport, setSelectedTransport] = useState<string>('');
	const [deliveryInfo, setDeliveryInfo] = useState({
		address: '',
		city: '',
		phone: '',
		notes: '',
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [geocodingError, setGeocodingError] = useState<string | null>(null);
	const router = useRouter();
	const supabase = createClient();

	useEffect(() => {
		const items = getCart();
		setCartItems(items);

		if (items.length === 0) {
			router.push('/cart');
			return;
		}

		// Fetch business details from the first cart item
		const fetchBusinessAndTransportServices = async () => {
			try {
				const businessId = items[0]?.item.business_id;
				if (!businessId) {
					throw new Error('No business ID found in cart items');
				}

				// Fetch business details
				const { data: businessData, error: businessError } = await supabase
					.from('businesses')
					.select('id, name, address, latitude, longitude')
					.eq('id', businessId)
					.single();

				if (businessError) throw businessError;
				setBusiness(businessData);

				// Fetch available transport services
				const { data: transportData } = await supabase
					.from('transport_services')
					.select(
						`
						*,
						driver:profiles(full_name, phone)
					`
					)
					.eq('status', 'available')
					.eq('is_verified', true)
					.order('rating', { ascending: false });

				if (transportData) setTransportServices(transportData);
			} catch (error: any) {
				setError(error.message);
			}
		};

		fetchBusinessAndTransportServices();
	}, [supabase, router]);

	// Validate delivery address in real-time
	useEffect(() => {
		const validateAddress = async () => {
			if (deliveryInfo.address && deliveryInfo.city) {
				setGeocodingError(null);
				try {
					const fullAddress = `${deliveryInfo.address}, ${deliveryInfo.city}`;
					// Use the same enhanced geocoding options as in order submission
					const coordinates = await geocodeAddress(fullAddress, {
						country: 'cm', // Cameroon country code
						proximity: business
							? [business.longitude, business.latitude]
							: [11.5174, 3.848], // Use business location or Cameroon center
					});
					if (!coordinates) {
						setGeocodingError(
							'Unable to verify this address. Please check and try again.'
						);
					} else if (coordinates.confidence && coordinates.confidence < 0.5) {
						// Lowered threshold from 0.7 to 0.5 for better user experience
						setGeocodingError(
							'Address may be incomplete or inaccurate. Please verify.'
						);
					}
				} catch (error) {
					setGeocodingError(
						'Error validating address. Please check your input.'
					);
				}
			} else {
				setGeocodingError(null);
			}
		};

		// Debounce address validation
		const timeoutId = setTimeout(validateAddress, 1500); // Increased from 1000ms to 1500ms
		return () => clearTimeout(timeoutId);
	}, [deliveryInfo.address, deliveryInfo.city, business]);

	const subtotal = getCartTotal();
	const tax = subtotal * 0.08;
	const selectedTransportService = transportServices.find(
		(t) => t.id === selectedTransport
	);

	// Calculate estimated distance for delivery fee (you might want to use actual geocoded distance later)
	const estimatedDistanceKm = 5; // Default estimate, can be improved with actual geocoding
	const deliveryFee = selectedTransportService
		? selectedTransportService.base_rate +
		  estimatedDistanceKm * selectedTransportService.per_km_rate
		: 0;
	const total = subtotal + tax + deliveryFee;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			if (!business) throw new Error('Business information not found');
			if (!selectedTransport)
				throw new Error('Please select a transport service');

			// Geocode delivery address with enhanced error handling
			const fullAddress = `${deliveryInfo.address}, ${deliveryInfo.city}`;
			console.log('Geocoding address:', fullAddress);

			const coordinates = await geocodeAddress(fullAddress, {
				country: 'cm', // Cameroon country code
				proximity: [business.longitude, business.latitude], // Use business location as proximity
			});

			if (!coordinates) {
				throw new Error(
					'Could not find the delivery address. Please ensure the address is in Cameroon and try a more specific address (include landmarks or well-known areas).'
				);
			}

			// Warn if confidence is low but still proceed
			if (coordinates.confidence && coordinates.confidence < 0.7) {
				console.warn('Low confidence geocoding result:', coordinates);
			}

			console.log('Geocoded coordinates:', coordinates);

			// Create order with proper data
			const { data: order, error: orderError } = await supabase
				.from('orders')
				.insert({
					user_id: user.id,
					business_id: business.id,
					total_amount: total,
					delivery_address: coordinates.formattedAddress || fullAddress,
					delivery_latitude: coordinates.latitude,
					delivery_longitude: coordinates.longitude,
					delivery_phone: deliveryInfo.phone,
					delivery_notes: deliveryInfo.notes,
					status: 'pending',
				})
				.select()
				.single();

			if (orderError) throw orderError;

			// Create order items
			const orderItems = cartItems.map((cartItem) => ({
				order_id: order.id,
				item_id: cartItem.item.id,
				quantity: cartItem.quantity,
				price: cartItem.item.price,
			}));

			const { error: itemsError } = await supabase
				.from('order_items')
				.insert(orderItems);

			if (itemsError) throw itemsError;

			// Calculate distance between business and delivery location for delivery fee calculation
			const distanceKm = calculateDistance(
				business.latitude,
				business.longitude,
				coordinates.latitude,
				coordinates.longitude
			);

			// Create delivery request with proper pickup coordinates from business
			const { error: deliveryError } = await supabase
				.from('deliveries')
				.insert({
					order_id: order.id,
					transport_service_id: selectedTransport,
					pickup_address: business.address,
					pickup_latitude: business.latitude,
					pickup_longitude: business.longitude,
					delivery_address: coordinates.formattedAddress || fullAddress,
					delivery_latitude: coordinates.latitude,
					delivery_longitude: coordinates.longitude,
					status: 'pending',
					delivery_fee: deliveryFee,
					distance_km: distanceKm,
					original_distance_km: distanceKm,
				});

			if (deliveryError) throw deliveryError;

			// Clear cart after successful order
			clearCart();

			// Redirect to success page
			router.push(`/success?orderId=${order.id}`);
		} catch (error: any) {
			console.error('Order creation error:', error);
			setError(error.message);
		} finally {
			setLoading(false);
		}
	};

	// Calculate distance between two coordinates using Haversine formula
	const calculateDistance = (
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number
	): number => {
		const R = 6371; // Radius of the Earth in kilometers
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = R * c;
		return Math.round(distance * 100) / 100; // Round to 2 decimal places
	};

	if (cartItems.length === 0) {
		return <div>Loading...</div>;
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-bold mb-8">Checkout</h1>

				{business && (
					<div className="mb-6 p-4 bg-blue-50 rounded-lg">
						<h3 className="font-semibold text-blue-900">Ordering from:</h3>
						<p className="text-blue-700">{business.name}</p>
						<p className="text-sm text-blue-600">{business.address}</p>
					</div>
				)}

				<form onSubmit={handleSubmit}>
					<div className="grid lg:grid-cols-2 gap-8">
						{/* Delivery Information */}
						<div className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center">
										<MapPin className="h-5 w-5 mr-2" />
										Delivery Information
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid md:grid-cols-2 gap-4">
										<div>
											<Label htmlFor="address">Street Address *</Label>
											<Input
												id="address"
												value={deliveryInfo.address}
												onChange={(e) =>
													setDeliveryInfo({
														...deliveryInfo,
														address: e.target.value,
													})
												}
												placeholder="e.g., Mile 17 Motor Park"
												required
											/>
										</div>
										<div>
											<Label htmlFor="city">City *</Label>
											<Input
												id="city"
												value={deliveryInfo.city}
												onChange={(e) =>
													setDeliveryInfo({
														...deliveryInfo,
														city: e.target.value,
													})
												}
												placeholder="e.g., Buea, Southwest Region"
												required
											/>
										</div>
									</div>

									{geocodingError && (
										<Alert variant="destructive">
											<AlertTriangle className="h-4 w-4" />
											<AlertDescription>{geocodingError}</AlertDescription>
										</Alert>
									)}

									<div>
										<Label htmlFor="phone">Phone Number *</Label>
										<Input
											id="phone"
											type="tel"
											value={deliveryInfo.phone}
											onChange={(e) =>
												setDeliveryInfo({
													...deliveryInfo,
													phone: e.target.value,
												})
											}
											placeholder="+237 XXX XXX XXX"
											required
										/>
									</div>
									<div>
										<Label htmlFor="notes">Delivery Notes (optional)</Label>
										<Textarea
											id="notes"
											value={deliveryInfo.notes}
											onChange={(e) =>
												setDeliveryInfo({
													...deliveryInfo,
													notes: e.target.value,
												})
											}
											placeholder="Special instructions for delivery (e.g., landmarks, building details)..."
										/>
									</div>
								</CardContent>
							</Card>

							{/* Transport Selection */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center">
										<Truck className="h-5 w-5 mr-2" />
										Select Transport Service
									</CardTitle>
								</CardHeader>
								<CardContent>
									{transportServices.length > 0 ? (
										<div className="space-y-3">
											{transportServices.map((service) => (
												<div
													key={service.id}
													className={`border rounded-lg p-4 cursor-pointer transition-colors ${
														selectedTransport === service.id
															? 'border-blue-500 bg-blue-50'
															: 'hover:bg-gray-50'
													}`}
													onClick={() => setSelectedTransport(service.id)}
												>
													<div className="flex items-center justify-between">
														<div>
															<h4 className="font-semibold">
																{service.service_name}
															</h4>
															<p className="text-sm text-gray-600">
																{service.vehicle_type}
															</p>
															<div className="flex items-center mt-1">
																<Badge variant="secondary" className="mr-2">
																	⭐ {service.rating.toFixed(1)}
																</Badge>
																<span className="text-xs text-gray-500">
																	{service.total_deliveries} deliveries
																</span>
															</div>
														</div>
														<div className="text-right">
															<p className="font-bold">
																{(
																	service.base_rate +
																	estimatedDistanceKm * service.per_km_rate
																).toFixed(0)}{' '}
																XAF
															</p>
															<p className="text-xs text-gray-500">
																Est. delivery fee (~{estimatedDistanceKm}km)
															</p>
														</div>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="text-center py-8">
											<Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
											<p className="text-gray-600">
												No transport services available
											</p>
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						{/* Order Summary */}
						<div>
							<Card>
								<CardHeader>
									<CardTitle>Order Summary</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{/* Cart Items */}
										<div className="space-y-3">
											{cartItems.map((cartItem) => (
												<div
													key={cartItem.item.id}
													className="flex justify-between items-center"
												>
													<div>
														<h4 className="font-semibold">
															{cartItem.item.name}
														</h4>
														<p className="text-sm text-gray-600">
															{(cartItem.item.price * 600).toFixed(0)} XAF ×{' '}
															{cartItem.quantity}
														</p>
													</div>
													<span className="font-semibold">
														{(
															cartItem.item.price *
															cartItem.quantity *
															600
														).toFixed(0)}{' '}
														XAF
													</span>
												</div>
											))}
										</div>

										<Separator />

										{/* Totals */}
										<div className="space-y-2">
											<div className="flex justify-between">
												<span>Subtotal</span>
												<span>{(subtotal * 600).toFixed(0)} XAF</span>
											</div>
											<div className="flex justify-between">
												<span>Tax (8%)</span>
												<span>{(tax * 600).toFixed(0)} XAF</span>
											</div>
											<div className="flex justify-between">
												<span>Delivery Fee</span>
												<span>{(deliveryFee * 600).toFixed(0)} XAF</span>
											</div>
											<Separator />
											<div className="flex justify-between font-bold text-lg">
												<span>Total</span>
												<span>{(total * 600).toFixed(0)} FCFA</span>
											</div>
										</div>

										{error && (
											<Alert variant="destructive">
												<AlertDescription>{error}</AlertDescription>
											</Alert>
										)}

										<Button
											type="submit"
											className="w-full"
											size="lg"
											disabled={
												loading || !selectedTransport || !!geocodingError
											}
										>
											{loading ? 'Placing Order...' : 'Place Order'}
										</Button>

										<div className="text-center">
											<div className="flex items-center justify-center text-sm text-gray-600">
												<CreditCard className="h-4 w-4 mr-2" />
												<span>Secure payment on delivery</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
