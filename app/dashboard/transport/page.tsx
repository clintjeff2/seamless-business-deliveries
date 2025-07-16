import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Delivery, DeliveryStatus } from '@/lib/types';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Truck, MapPin, Clock, DollarSign, Star } from 'lucide-react';
import { ServiceStatusCard } from '@/components/transport/ServiceStatusCard';
import { DeliveryStatusCard } from '@/components/transport/DeliveryStatusCard';
import { formatXAF } from '@/lib/utils';

export default async function TransportDashboardPage() {
	const user = await requireRole('transport');
	const supabase = await createClient();

	// Fetch transport service info
	const { data: transportService } = await supabase
		.from('transport_services')
		.select('*')
		.eq('driver_id', user.id)
		.single();

	// Fetch recent deliveries with more details
	const { data: deliveries } = await supabase
		.from('deliveries')
		.select(
			`
      *,
      orders(
        *,
        business:businesses(name),
        order_items(*, item:items(name, price))
      )
    `
		)
		.eq('transport_service_id', transportService?.id)
		.order('created_at', { ascending: false })
		.limit(10);

	const stats = {
		totalDeliveries: deliveries?.length || 0,
		activeDeliveries:
			deliveries?.filter((d: Delivery) =>
				['accepted', 'picked_up', 'in_transit'].includes(d.status)
			).length || 0,
		completedDeliveries:
			deliveries?.filter((d: Delivery) => d.status === 'delivered').length || 0,
		totalEarnings:
			deliveries
				?.filter((d: Delivery) => d.status === 'delivered')
				.reduce((sum: number, d: Delivery) => sum + (d.delivery_fee || 0), 0) ||
			0,
	};

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Mobile responsive header */}
			<div className="mb-6 sm:mb-8">
				<h1 className="text-2xl sm:text-3xl font-bold">Transport Dashboard</h1>
				<p className="text-gray-600 text-sm sm:text-base">
					{transportService?.service_name || 'Your Transport Service'}
				</p>
			</div>

			{!transportService ? (
				<Card>
					<CardContent className="p-6 sm:p-8 text-center">
						<h2 className="text-lg sm:text-xl font-semibold mb-4">
							Complete Your Transport Setup
						</h2>
						<p className="text-gray-600 mb-6 text-sm sm:text-base">
							You need to complete your transport service registration to start
							delivering.
						</p>
						<Button asChild className="w-full sm:w-auto">
							<Link href="/register/transport">Complete Setup</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-6 sm:space-y-8">
					{/* Stats Cards - Mobile responsive grid */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
						<Card>
							<CardContent className="p-4 sm:p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs sm:text-sm text-gray-600">
											Total Deliveries
										</p>
										<p className="text-lg sm:text-2xl font-bold">
											{stats.totalDeliveries}
										</p>
									</div>
									<Truck className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 sm:p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs sm:text-sm text-gray-600">
											Active Deliveries
										</p>
										<p className="text-lg sm:text-2xl font-bold">
											{stats.activeDeliveries}
										</p>
									</div>
									<Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 sm:p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs sm:text-sm text-gray-600">
											Completed
										</p>
										<p className="text-lg sm:text-2xl font-bold">
											{stats.completedDeliveries}
										</p>
									</div>
									<Star className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-4 sm:p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs sm:text-sm text-gray-600">
											Total Earnings
										</p>
										<p className="text-lg sm:text-2xl font-bold">
											{formatXAF(stats.totalEarnings)}
										</p>
									</div>
									<DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
								</div>
							</CardContent>
						</Card>
					</div>

					<div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
						{/* Service Status */}
						<ServiceStatusCard transportService={transportService} />

						{/* Recent Deliveries */}
						<Card>
							<CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
								<div>
									<CardTitle className="text-lg sm:text-xl">
										Recent Deliveries
									</CardTitle>
									<CardDescription className="text-sm">
										Your latest delivery requests
									</CardDescription>
								</div>
								<Button
									asChild
									size="sm"
									variant="outline"
									className="w-full sm:w-auto"
								>
									<Link href="/dashboard/transport/requests">View All</Link>
								</Button>
							</CardHeader>
							<CardContent>
								{deliveries && deliveries.length > 0 ? (
									<div className="space-y-4 sm:space-y-6">
										{deliveries
											.filter((d: Delivery) =>
												[
													'pending',
													'accepted',
													'picked_up',
													'in_transit',
												].includes(d.status)
											)
											.slice(0, 3)
											.map((delivery: Delivery) => (
												<Card key={delivery.id} className="border">
													<CardContent className="p-3 sm:p-4">
														<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 mb-4">
															<div className="flex-1">
																<h4 className="font-semibold text-sm sm:text-base">
																	{delivery.orders?.business?.name}
																</h4>
																<p className="text-xs sm:text-sm text-gray-600 flex items-start sm:items-center">
																	<MapPin className="h-3 w-3 mt-0.5 sm:mt-0 mr-1 flex-shrink-0" />
																	<span className="break-words">
																		{delivery.delivery_address.slice(0, 50)}
																		{delivery.delivery_address.length > 50
																			? '...'
																			: ''}
																	</span>
																</p>
															</div>
															<div className="flex items-center justify-between sm:justify-end space-x-2">
																<Badge
																	variant={
																		delivery.status === 'pending'
																			? 'secondary'
																			: 'default'
																	}
																	className="text-xs"
																>
																	{delivery.status}
																</Badge>
																{delivery.status === 'in_transit' && (
																	<Button
																		asChild
																		size="sm"
																		variant="outline"
																		className="text-xs px-2 py-1"
																	>
																		<Link
																			href={`/delivery/${delivery.id}/navigate`}
																		>
																			<MapPin className="h-3 w-3 mr-1" />
																			Navigate
																		</Link>
																	</Button>
																)}
															</div>
														</div>
														<DeliveryStatusCard delivery={delivery} />
													</CardContent>
												</Card>
											))}
									</div>
								) : (
									<div className="text-center py-6 sm:py-8">
										<Truck className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-4" />
										<p className="text-gray-600 text-sm sm:text-base">
											No deliveries yet
										</p>
										<p className="text-xs sm:text-sm text-gray-500 mt-2">
											Go online to start receiving delivery requests
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</div>
	);
}
