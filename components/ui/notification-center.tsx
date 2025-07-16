'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Package, Clock, MapPin, X, Check } from 'lucide-react';
import { formatXAF } from '@/lib/utils';
import { format } from 'date-fns';

interface Notification {
	id: string;
	type: string;
	title: string;
	message: string;
	data: any;
	is_read: boolean;
	priority: 'low' | 'normal' | 'high' | 'urgent';
	created_at: string;
	expires_at?: string;
}

interface NotificationCenterProps {
	userId: string;
	userRole: 'transport' | 'customer' | 'business';
}

export function NotificationCenter({
	userId,
	userRole,
}: NotificationCenterProps) {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const supabase = createClient();

	// Fetch notifications
	const fetchNotifications = async () => {
		try {
			const { data, error } = await supabase
				.from('notifications')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(20);

			if (error) throw error;

			setNotifications(data || []);
			setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
		} catch (error) {
			console.error('Error fetching notifications:', error);
		} finally {
			setLoading(false);
		}
	};

	// Mark notifications as read
	const markAsRead = async (notificationIds?: string[]) => {
		try {
			const { error } = await supabase.rpc('mark_notifications_read', {
				p_user_id: userId,
				p_notification_ids: notificationIds || null,
			});

			if (error) throw error;

			// Update local state
			setNotifications((prev) =>
				prev.map((n) =>
					!notificationIds || notificationIds.includes(n.id)
						? { ...n, is_read: true }
						: n
				)
			);

			if (!notificationIds) {
				setUnreadCount(0);
			} else {
				setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
			}
		} catch (error) {
			console.error('Error marking notifications as read:', error);
		}
	};

	// Handle notification action (for order notifications)
	const handleNotificationAction = async (
		notification: Notification,
		action: 'accept' | 'dismiss'
	) => {
		if (notification.type === 'order_placed' && action === 'accept') {
			// Navigate to accept the delivery
			const orderId = notification.data.order_id;
			window.location.href = `/dashboard/transport/requests?order=${orderId}`;
		}

		// Mark as read
		await markAsRead([notification.id]);
	};

	// Set up real-time subscriptions
	useEffect(() => {
		fetchNotifications();

		// Subscribe to new notifications
		const channel = supabase
			.channel(`notifications-${userId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'notifications',
					filter: `user_id=eq.${userId}`,
				},
				(payload) => {
					const newNotification = payload.new as Notification;
					setNotifications((prev) => [newNotification, ...prev]);
					setUnreadCount((prev) => prev + 1);

					// Show browser notification for high priority
					if (
						newNotification.priority === 'high' ||
						newNotification.priority === 'urgent'
					) {
						if (
							'Notification' in window &&
							Notification.permission === 'granted'
						) {
							new Notification(newNotification.title, {
								body: newNotification.message,
								icon: '/placeholder-logo.png',
							});
						}
					}
				}
			)
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	}, [userId, supabase]);

	// Request notification permission
	useEffect(() => {
		if ('Notification' in window && Notification.permission === 'default') {
			Notification.requestPermission();
		}
	}, []);

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case 'urgent':
				return 'border-red-500 bg-red-50';
			case 'high':
				return 'border-orange-500 bg-orange-50';
			case 'normal':
				return 'border-blue-500 bg-blue-50';
			default:
				return 'border-gray-500 bg-gray-50';
		}
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case 'order_placed':
				return <Package className="h-4 w-4" />;
			case 'delivery_accepted':
				return <Check className="h-4 w-4" />;
			case 'delivery_picked_up':
			case 'delivery_in_transit':
				return <MapPin className="h-4 w-4" />;
			default:
				return <Bell className="h-4 w-4" />;
		}
	};

	return (
		<div className="relative">
			{/* Notification Bell */}
			<Button
				variant="outline"
				size="sm"
				onClick={() => setIsOpen(!isOpen)}
				className="relative"
			>
				<Bell className="h-4 w-4" />
				{unreadCount > 0 && (
					<Badge
						variant="destructive"
						className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs"
					>
						{unreadCount > 9 ? '9+' : unreadCount}
					</Badge>
				)}
			</Button>

			{/* Notification Panel */}
			{isOpen && (
				<div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
					<div className="p-4 border-b border-gray-200 dark:border-gray-700">
						<div className="flex items-center justify-between">
							<h3 className="font-semibold">Notifications</h3>
							<div className="flex items-center space-x-2">
								{unreadCount > 0 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => markAsRead()}
									>
										Mark all read
									</Button>
								)}
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsOpen(false)}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>

					<div className="max-h-80 overflow-y-auto">
						{loading ? (
							<div className="p-4 text-center">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
								<p className="mt-2 text-sm text-gray-600">
									Loading notifications...
								</p>
							</div>
						) : notifications.length === 0 ? (
							<div className="p-4 text-center text-gray-600">
								<Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p>No notifications yet</p>
							</div>
						) : (
							<div className="divide-y divide-gray-200 dark:divide-gray-700">
								{notifications.map((notification) => (
									<div
										key={notification.id}
										className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 ${
											!notification.is_read
												? 'bg-blue-50 dark:bg-blue-900/20'
												: ''
										}`}
									>
										<div className="flex items-start space-x-3">
											<div
												className={`p-2 rounded-full ${getPriorityColor(
													notification.priority
												)}`}
											>
												{getTypeIcon(notification.type)}
											</div>

											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<p className="text-sm font-medium truncate">
														{notification.title}
													</p>
													<span className="text-xs text-gray-500">
														{format(
															new Date(notification.created_at),
															'MMM d, HH:mm'
														)}
													</span>
												</div>

												<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
													{notification.message}
												</p>

												{/* Order notification specific content */}
												{notification.type === 'order_placed' &&
													notification.data && (
														<div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
															<p>
																<strong>From:</strong>{' '}
																{notification.data.business_name}
															</p>
															<p>
																<strong>To:</strong>{' '}
																{notification.data.delivery_address}
															</p>
															<p>
																<strong>Amount:</strong>{' '}
																{formatXAF(notification.data.total_amount)}
															</p>

															<div className="flex space-x-2 mt-2">
																<Button
																	size="sm"
																	onClick={() =>
																		handleNotificationAction(
																			notification,
																			'accept'
																		)
																	}
																	className="text-xs px-2 py-1"
																>
																	Accept
																</Button>
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() =>
																		handleNotificationAction(
																			notification,
																			'dismiss'
																		)
																	}
																	className="text-xs px-2 py-1"
																>
																	Dismiss
																</Button>
															</div>
														</div>
													)}

												{!notification.is_read && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => markAsRead([notification.id])}
														className="text-xs mt-1 p-0 h-auto"
													>
														Mark as read
													</Button>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
