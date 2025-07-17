'use client';

import { useState, useEffect } from 'react';
import { DeliveryChat } from '@/components/ui/delivery-chat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Phone, Minimize2, Maximize2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FloatingChatProps {
	deliveryId: string;
	currentUserId: string;
	userType: 'customer' | 'driver';
	otherUserPhone?: string;
	className?: string;
}

interface DeliveryMessage {
	id: string;
	sender_id: string;
	chat_id: string;
	content: string;
	is_read: boolean;
	created_at: string;
}

export function FloatingChat({
	deliveryId,
	currentUserId,
	userType,
	otherUserPhone,
	className = '',
}: FloatingChatProps) {
	const [showChat, setShowChat] = useState(false);
	const [isChatMinimized, setIsChatMinimized] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const [isVisible, setIsVisible] = useState(false);
	const [deliveryStatus, setDeliveryStatus] = useState<string>('');
	const [otherUserInfo, setOtherUserInfo] = useState<any>(null);
	const [isOnline, setIsOnline] = useState(false);
	const [chatId, setChatId] = useState<string | null>(null);
	const supabase = createClient();

	// Check delivery status and chat availability
	useEffect(() => {
		const checkDeliveryAndChat = async () => {
			try {
				// First, get the delivery status with related info
				const { data: delivery } = await supabase
					.from('deliveries')
					.select(
						`
						status,
						transport_service:transport_services(
							service_name,
							phone,
							driver:profiles!transport_services_driver_id_fkey(full_name, avatar_url, phone)
						),
						orders(
							customer:profiles!orders_user_id_fkey(full_name, avatar_url, phone)
						)
					`
					)
					.eq('id', deliveryId)
					.single();

				if (delivery) {
					setDeliveryStatus(delivery.status);

					// Set other user info based on current user type
					if (userType === 'customer') {
						setOtherUserInfo({
							name:
								delivery.transport_service?.driver?.full_name ||
								delivery.transport_service?.service_name,
							avatar: delivery.transport_service?.driver?.avatar_url,
							phone: delivery.transport_service?.phone,
							type: 'Driver',
						});
					} else {
						setOtherUserInfo({
							name: delivery.orders?.customer?.full_name,
							avatar: delivery.orders?.customer?.avatar_url,
							phone: delivery.orders?.customer?.phone,
							type: 'Customer',
						});
					}

					// Show chat for deliveries that are accepted or beyond
					const chatEnabledStatuses = [
						'accepted',
						'picked_up',
						'in_transit',
						'delivered',
					];
					if (chatEnabledStatuses.includes(delivery.status)) {
						setIsVisible(true);

						// Check if chat exists and get unread count
						const { data: chatData } = await supabase
							.from('delivery_chats')
							.select('id')
							.eq('delivery_id', deliveryId)
							.single();

						if (chatData) {
							setChatId(chatData.id);

							// Get unread count
							const { data: unreadMessages } = await supabase
								.from('delivery_messages')
								.select('id')
								.eq('chat_id', chatData.id)
								.eq('is_read', false)
								.neq('sender_id', currentUserId);

							setUnreadCount(unreadMessages?.length || 0);

							// Check online status
							const { data: participantData } = await supabase
								.from('delivery_chat_participants')
								.select('is_online, last_seen_at')
								.eq('chat_id', chatData.id)
								.neq('user_id', currentUserId)
								.single();

							if (participantData) {
								const lastSeenDate = new Date(participantData.last_seen_at);
								const now = new Date();
								const diffInMinutes = Math.floor(
									(now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
								);
								setIsOnline(participantData.is_online || diffInMinutes < 2);
							}
						}
					}
				}
			} catch (error) {
				console.error('Error checking delivery and chat status:', error);
			}
		};

		if (deliveryId && currentUserId) {
			checkDeliveryAndChat();
		}
	}, [deliveryId, currentUserId, userType, supabase]);

	// Set up real-time subscription for unread count
	useEffect(() => {
		if (!chatId) return;

		const messagesChannel = supabase
			.channel(`floating-chat-messages-${chatId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'delivery_messages',
					filter: `chat_id=eq.${chatId}`,
				},
				(payload: { new: DeliveryMessage }) => {
					const newMessage = payload.new;
					if (newMessage.sender_id !== currentUserId && !showChat) {
						setUnreadCount((prev) => prev + 1);
						// Show notification sound or vibration
						if ('vibrate' in navigator) {
							navigator.vibrate(200);
						}
					}
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'delivery_messages',
					filter: `chat_id=eq.${chatId}`,
				},
				() => {
					// Refresh unread count when messages are marked as read
					if (!showChat) {
						supabase
							.from('delivery_messages')
							.select('id')
							.eq('chat_id', chatId)
							.eq('is_read', false)
							.neq('sender_id', currentUserId)
							.then(({ data }: { data: any[] | null }) => {
								setUnreadCount(data?.length || 0);
							});
					}
				}
			)
			.subscribe();

		// Set up presence subscription
		const presenceChannel = supabase
			.channel(`floating-chat-presence-${chatId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'delivery_chat_participants',
					filter: `chat_id=eq.${chatId}`,
				},
				(payload: { new: any }) => {
					const updatedParticipant = payload.new;
					if (updatedParticipant.user_id !== currentUserId) {
						const lastSeenDate = new Date(updatedParticipant.last_seen_at);
						const now = new Date();
						const diffInMinutes = Math.floor(
							(now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
						);
						setIsOnline(updatedParticipant.is_online || diffInMinutes < 2);
					}
				}
			)
			.subscribe();

		return () => {
			messagesChannel.unsubscribe();
			presenceChannel.unsubscribe();
		};
	}, [chatId, currentUserId, showChat, supabase]);

	// Reset unread count when chat is opened
	useEffect(() => {
		if (showChat && !isChatMinimized) {
			setUnreadCount(0);
		}
	}, [showChat, isChatMinimized]);

	// Handle chat close
	const handleCloseChat = () => {
		setShowChat(false);
		setIsChatMinimized(false);
	};

	// Handle chat minimize/maximize
	const handleToggleMinimize = () => {
		setIsChatMinimized(!isChatMinimized);
		if (!isChatMinimized) {
			setUnreadCount(0);
		}
	};

	// Don't show chat for pending or cancelled deliveries
	if (
		!isVisible ||
		deliveryStatus === 'pending' ||
		deliveryStatus === 'cancelled'
	) {
		return null;
	}

	return (
		<div className={`fixed z-50 ${className}`}>
			{/* Floating Chat Button */}
			{!showChat && (
				<div className="flex flex-col items-end space-y-3">
					{/* Quick Call Button */}
					{otherUserPhone && (
						<div className="group relative">
							<Button
								onClick={() => window.open(`tel:${otherUserPhone}`)}
								className="h-12 w-12 rounded-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"
								size="sm"
							>
								<Phone className="h-5 w-5" />
							</Button>
							<div className="absolute right-14 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
								Call {otherUserInfo?.type}
							</div>
						</div>
					)}

					{/* Enhanced Chat Button */}
					<div className="group relative">
						<div className="relative">
							<Button
								onClick={() => setShowChat(true)}
								className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl animate-pulse"
								size="sm"
							>
								<MessageCircle className="h-7 w-7" />
							</Button>

							{/* Online Status Indicator */}
							{isOnline && (
								<div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
							)}

							{/* Unread Count Badge */}
							{unreadCount > 0 && (
								<Badge
									variant="destructive"
									className="absolute -top-2 -left-2 min-w-[24px] h-6 flex items-center justify-center text-xs font-bold animate-bounce shadow-lg"
								>
									{unreadCount > 99 ? '99+' : unreadCount}
								</Badge>
							)}
						</div>

						{/* Tooltip */}
						<div className="absolute right-20 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
							<div className="font-semibold">
								Chat with {otherUserInfo?.name}
							</div>
							<div className="text-gray-300">
								{otherUserInfo?.type} • {isOnline ? 'Online' : 'Offline'}
							</div>
							{unreadCount > 0 && (
								<div className="text-red-300 font-semibold">
									{unreadCount} unread message{unreadCount > 1 ? 's' : ''}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Enhanced Chat Component */}
			{showChat && (
				<div
					className={`transition-all duration-300 ${
						isChatMinimized ? 'w-80' : 'w-80 md:w-96'
					}`}
				>
					<div className="bg-white rounded-t-2xl shadow-2xl border border-gray-200 overflow-hidden">
						{/* Enhanced Chat Header */}
						<div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<div className="relative">
										<div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-semibold">
											{otherUserInfo?.avatar ? (
												<img
													src={otherUserInfo.avatar}
													alt={otherUserInfo.name}
													className="w-full h-full rounded-full object-cover"
												/>
											) : (
												otherUserInfo?.name?.charAt(0) || 'U'
											)}
										</div>
										{isOnline && (
											<div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
										)}
									</div>
									<div>
										<h3 className="font-semibold text-sm">
											{otherUserInfo?.name || 'User'}
										</h3>
										<p className="text-xs text-blue-100">
											{otherUserInfo?.type} • {isOnline ? 'Online' : 'Offline'}
										</p>
									</div>
								</div>

								<div className="flex items-center space-x-2">
									{unreadCount > 0 && !isChatMinimized && (
										<Badge
											variant="secondary"
											className="bg-white/20 text-white text-xs"
										>
											{unreadCount}
										</Badge>
									)}
									<Button
										variant="ghost"
										size="sm"
										onClick={handleToggleMinimize}
										className="h-8 w-8 p-0 text-white hover:bg-white/20"
									>
										{isChatMinimized ? (
											<Maximize2 className="h-4 w-4" />
										) : (
											<Minimize2 className="h-4 w-4" />
										)}
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={handleCloseChat}
										className="h-8 w-8 p-0 text-white hover:bg-white/20"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>

						{/* Chat Content */}
						{!isChatMinimized && (
							<DeliveryChat
								deliveryId={deliveryId}
								currentUserId={currentUserId}
								userType={userType}
								isMinimized={isChatMinimized}
								onToggleMinimize={handleToggleMinimize}
								onClose={handleCloseChat}
								className="border-0 rounded-none shadow-none"
							/>
						)}
					</div>
				</div>
			)}

			{/* Floating Animation Styles */}
			<style jsx>{`
				@keyframes float {
					0%,
					100% {
						transform: translateY(0px);
					}
					50% {
						transform: translateY(-10px);
					}
				}
				.animate-float {
					animation: float 3s ease-in-out infinite;
				}
			`}</style>
		</div>
	);
}
