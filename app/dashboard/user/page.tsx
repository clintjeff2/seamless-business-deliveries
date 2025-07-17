'use client';

import { useState, useEffect } from 'react';
import { requireRole } from '@/lib/auth';
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
import { Package, ShoppingCart, MapPin, Star, Clock } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { formatXAF } from '@/lib/utils';

// Demo data for when Supabase is not configured
const DEMO_ORDERS = [
	{
		id: 'demo-order-1',
		total_amount: 45.99,
		status: 'delivered',
		created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
		business: {
			name: 'Demo Restaurant',
			logo_url: null,
		},
		delivery: {
			status: 'delivered',
			estimated_delivery_time: new Date(Date.now() - 82800000).toISOString(),
		},
	},
	{
		id: 'demo-order-2',
		total_amount: 23.5,
		status: 'in_transit',
		created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
		business: {
			name: 'Demo Electronics Store',
			logo_url: null,
		},
		delivery: {
			id: 'demo-delivery-1',
			status: 'in_transit',
			estimated_delivery_time: new Date(Date.now() + 1800000).toISOString(), // 30 min from now
		},
	},
	{
		id: 'demo-order-3',
		total_amount: 67.25,
		status: 'pending',
		created_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
		business: {
			name: 'Demo Fashion Store',
			logo_url: null,
		},
		delivery: {
			status: 'pending',
			estimated_delivery_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
		},
	},
];

const DEMO_ITEMS = [
	{
		id: 'demo-item-1',
		name: 'Wireless Headphones',
		price: 89.99,
		business: {
			name: 'TechStore Pro',
			rating: 4.5,
		},
	},
	{
		id: 'demo-item-2',
		name: 'Organic Coffee Beans',
		price: 24.99,
		business: {
			name: 'Coffee Corner',
			rating: 4.8,
		},
	},
	{
		id: 'demo-item-3',
		name: 'Designer T-Shirt',
		price: 39.99,
		business: {
			name: 'Fashion Hub',
			rating: 4.3,
		},
	},
	{
		id: 'demo-item-4',
		name: 'Smartphone Case',
		price: 19.99,
		business: {
			name: 'Mobile Accessories',
			rating: 4.6,
		},
	},
	{
		id: 'demo-item-5',
		name: 'Artisan Pizza',
		price: 16.99,
		business: {
			name: 'Bella Italia',
			rating: 4.9,
		},
	},
	{
		id: 'demo-item-6',
		name: 'Running Shoes',
		price: 129.99,
		business: {
			name: 'SportZone',
			rating: 4.4,
		},
	},
];

// Check if we have valid Supabase configuration
const hasSupabaseConfig = () => {
	return !!(
		process.env.NEXT_PUBLIC_SUPABASE_URL &&
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	);
};

export default function UserDashboardPage() {
	const [user, setUser] = useState<any>(null);
	const [orders, setOrders] = useState<any[]>(DEMO_ORDERS);
	const [recommendedItems, setRecommendedItems] = useState<any[]>(DEMO_ITEMS);
	const [loading, setLoading] = useState(true);
	const supabase = createClient();
	const isDemo = !hasSupabaseConfig();

	useEffect(() => {
		const initializeDashboard = async () => {
			if (isDemo) {
				setLoading(false);
				return;
			}

			try {
				// Get user info
				const {
					data: { user: authUser },
				} = await supabase.auth.getUser();

				if (!authUser) {
					window.location.href = '/login';
					return;
				}

				setUser(authUser);

				// Fetch user's recent orders
				const { data: ordersData } = await supabase
					.from('orders')
					.select(
						`
						*,
						business:businesses(name, logo_url, category:categories(icon)),
						order_items(
							*,
							item:items(name, price, image_url)
						),
						delivery:deliveries(
							id,
							status,
							estimated_delivery_time,
							actual_delivery_time,
							transport_service:transport_services(service_name, phone)
						)
					`
					)
					.eq('user_id', authUser.id)
					.order('created_at', { ascending: false })
					.limit(5);

				// Fetch recommended items
				const { data: itemsData } = await supabase
					.from('items')
					.select(
						`
						*,
						business:businesses(name, rating)
					`
					)
					.eq('is_available', true)
					.order('created_at', { ascending: false })
					.limit(6);

				if (ordersData) setOrders(ordersData);
				if (itemsData) setRecommendedItems(itemsData);

				// Set up real-time subscriptions for order updates
				const orderChannel = supabase
					.channel('user-orders-updates')
					.on(
						'postgres_changes',
						{
							event: 'UPDATE',
							schema: 'public',
							table: 'orders',
							filter: `user_id=eq.${authUser.id}`,
						},
						(payload) => {
							setOrders((prevOrders) =>
								prevOrders.map((order) =>
									order.id === payload.new.id
										? { ...order, ...payload.new }
										: order
								)
							);
						}
					)
					.subscribe();

				// Set up real-time subscriptions for delivery updates
				const deliveryChannel = supabase
					.channel('user-deliveries-updates')
					.on(
						'postgres_changes',
						{
							event: 'UPDATE',
							schema: 'public',
							table: 'deliveries',
						},
						(payload) => {
							setOrders((prevOrders) =>
								prevOrders.map((order) => {
									if (
										order.delivery?.[0]?.id === payload.new.id ||
										order.delivery?.id === payload.new.id
									) {
										return {
											...order,
											delivery: Array.isArray(order.delivery)
												? [{ ...order.delivery[0], ...payload.new }]
												: { ...order.delivery, ...payload.new },
										};
									}
									return order;
								})
							);
						}
					)
					.subscribe();

				// Cleanup subscriptions on unmount
				return () => {
					orderChannel.unsubscribe();
					deliveryChannel.unsubscribe();
				};
			} catch (error) {
				console.error('Error fetching user data:', error);
			} finally {
				setLoading(false);
			}
		};

		initializeDashboard();
	}, [supabase, isDemo]);

	// Helper function to get order status badge
	const getOrderStatusBadge = (order: any) => {
		if (order.delivery?.[0]?.status || order.delivery?.status) {
			const deliveryStatus =
				order.delivery?.[0]?.status || order.delivery?.status;
			switch (deliveryStatus) {
				case 'pending':
					return <Badge variant="secondary">Awaiting Driver</Badge>;
				case 'accepted':
					return <Badge variant="outline">Driver Assigned</Badge>;
				case 'picked_up':
					return <Badge variant="outline">Picked Up</Badge>;
				case 'in_transit':
					return <Badge variant="default">In Transit</Badge>;
				case 'delivered':
					return <Badge variant="default">Delivered</Badge>;
				case 'cancelled':
					return <Badge variant="destructive">Cancelled</Badge>;
				default:
					return <Badge variant="secondary">{order.status}</Badge>;
			}
		}
		return <Badge variant="secondary">{order.status}</Badge>;
	};

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="animate-pulse space-y-6">
					<div className="h-8 bg-gray-200 rounded w-1/3"></div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-32 bg-gray-200 rounded"></div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Mobile responsive header */}
			<div className="mb-6 sm:mb-8">
				<h1 className="text-2xl sm:text-3xl font-bold">
					Welcome back, {user.profile?.full_name}!
				</h1>
				<p className="text-gray-600 text-sm sm:text-base">
					Track your orders and discover new items
				</p>
				{isDemo && (
					<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<p className="text-sm text-blue-800">
							🚀 Demo Mode: This is a preview with sample data. Connect Supabase
							to enable full functionality.
						</p>
					</div>
				)}
			</div>

			<div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
				{/* Main Content */}
				<div className="lg:col-span-2 space-y-6 sm:space-y-8">
					{/* Quick Actions - Mobile responsive grid */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<Card>
							<CardContent className="p-4 sm:p-6 text-center">
								<ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-blue-600" />
								<h3 className="font-semibold text-sm sm:text-base">
									Browse Items
								</h3>
								<p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
									Discover new products
								</p>
								<Button asChild size="sm" className="w-full sm:w-auto">
									<Link href="/businesses">Shop Now</Link>
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 sm:p-6 text-center">
								<MapPin className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-green-600" />
								<h3 className="font-semibold text-sm sm:text-base">
									Track Orders
								</h3>
								<p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
									Live delivery tracking
								</p>
								<Button
									asChild
									size="sm"
									variant="outline"
									className="w-full sm:w-auto"
								>
									<Link href="/my-orders">View Orders</Link>
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 sm:p-6 text-center">
								<Package className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-purple-600" />
								<h3 className="font-semibold text-sm sm:text-base">
									Order History
								</h3>
								<p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
									View past purchases
								</p>
								<Button
									asChild
									size="sm"
									variant="outline"
									className="w-full sm:w-auto"
								>
									<Link href="/my-orders">View All</Link>
								</Button>
							</CardContent>
						</Card>
					</div>

					{/* Recent Orders */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg sm:text-xl">
								Recent Orders
							</CardTitle>
							<CardDescription className="text-sm">
								Your latest purchases and their status
							</CardDescription>
						</CardHeader>
						<CardContent>
							{orders && orders.length > 0 ? (
								<div className="space-y-4">
									{orders.map((order: any) => (
										<div
											key={order.id}
											className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0"
										>
											<div className="flex items-center space-x-3 sm:space-x-4">
												<div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
													{order.business?.image_url ? (
														<Image
															src={order.business.image_url}
															alt={order.business.name}
															width={48}
															height={48}
															className="object-cover w-full h-full"
														/>
													) : (
														<Package className="h-4 w-4 sm:h-6 sm:w-6 text-gray-600" />
													)}
												</div>
												<div className="min-w-0 flex-1">
													<h4 className="font-semibold text-sm sm:text-base">
														{order.business?.name}
													</h4>
													<p className="text-sm text-gray-600">
														{formatXAF(order.total_amount)}
													</p>
													<p className="text-xs text-gray-500">
														{new Date(order.created_at).toLocaleDateString()}
													</p>
												</div>
											</div>
											<div className="flex items-center justify-between sm:justify-end sm:text-right space-x-2">
												<Badge
													variant={
														order.delivery?.[0]?.status === 'delivered'
															? 'default'
															: 'secondary'
													}
													className="text-xs"
												>
													{order.delivery?.[0]?.status || order.status}
												</Badge>
												{order.delivery?.[0]?.status === 'in_transit' && (
													<Button
														asChild
														size="sm"
														className="text-xs px-2 py-1"
													>
														<Link
															href={`/delivery/${order.delivery[0].id}/track`}
														>
															Track
														</Link>
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="text-center py-6 sm:py-8">
									<Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-4" />
									<p className="text-gray-600 text-sm sm:text-base">
										No orders yet
									</p>
									<Button asChild className="mt-4 w-full sm:w-auto">
										<Link href="/businesses">Start Shopping</Link>
									</Button>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Recommended Items */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg sm:text-xl">
								Recommended for You
							</CardTitle>
							<CardDescription className="text-sm">
								Items you might like based on your preferences
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{recommendedItems?.map((item: any) => (
									<Link
										key={item.id}
										href={`/items/${item.id}`}
										className="group"
									>
										<div className="border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
											<div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
												{item.image_url ? (
													<Image
														src={item.image_url}
														alt={item.name}
														width={200}
														height={200}
														className="w-full h-full object-cover group-hover:scale-105 transition-transform"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center">
														<Package className="h-8 w-8 text-gray-400" />
													</div>
												)}
											</div>
											<h4 className="font-medium text-sm group-hover:text-blue-600 line-clamp-2">
												{item.name}
											</h4>
											<p className="text-sm text-gray-600 mt-1">
												{formatXAF(item.price)}
											</p>
											<div className="flex items-center mt-2 text-xs text-gray-500">
												<span>{item.business?.name}</span>
												<span className="mx-1">•</span>
												<div className="flex items-center">
													⭐ {item.business?.rating || 'New'}
												</div>
											</div>
										</div>
									</Link>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Profile Quick View */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Profile</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div>
									<p className="text-sm text-gray-600">Name</p>
									<p className="font-semibold text-sm sm:text-base">
										{user.profile?.full_name}
									</p>
								</div>
								<div>
									<p className="text-sm text-gray-600">Email</p>
									<p className="font-semibold text-sm break-all">
										{user.email}
									</p>
								</div>
								<div>
									<p className="text-sm text-gray-600">Phone</p>
									<p className="font-semibold text-sm">
										{user.profile?.phone || 'Not set'}
									</p>
								</div>
								<Button
									asChild
									variant="outline"
									className="w-full bg-transparent"
								>
									<Link href="/profile">Edit Profile</Link>
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Active Deliveries */}
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Active Deliveries</CardTitle>
						</CardHeader>
						<CardContent>
							{orders.some(
								(order: any) => order.delivery?.[0]?.status === 'in_transit'
							) ? (
								<div className="space-y-3">
									{orders
										.filter(
											(order: any) =>
												order.delivery?.[0]?.status === 'in_transit'
										)
										.map((order: any) => (
											<div key={order.id} className="p-3 border rounded-lg">
												<h4 className="font-semibold text-sm">
													{order.business?.name}
												</h4>
												<p className="text-xs text-gray-600">
													Order #{order.id.slice(0, 8)}
												</p>
												<Button asChild size="sm" className="mt-2 w-full">
													<Link
														href={`/delivery/${order.delivery[0].id}/track`}
													>
														Track Live
													</Link>
												</Button>
											</div>
										))}
								</div>
							) : (
								<div className="text-center py-4">
									<Clock className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-gray-400 mb-2" />
									<p className="text-sm text-gray-600">No active deliveries</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
