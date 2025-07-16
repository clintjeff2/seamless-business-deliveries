'use client';

import { useState, useEffect } from 'react';
import { DeliveryChat } from '@/components/ui/delivery-chat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FloatingChatProps {
	deliveryId: string;
	currentUserId: string;
	userType: 'customer' | 'driver';
	otherUserPhone?: string;
	className?: string;
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
	const supabase = createClient();

	// Check delivery status and chat availability
	useEffect(() => {
		const checkDeliveryAndChat = async () => {
			try {
				// First, get the delivery status
				const { data: delivery } = await supabase
					.from('deliveries')
					.select('status')
					.eq('id', deliveryId)
					.single();

				if (delivery) {
					setDeliveryStatus(delivery.status);

					// Show chat for deliveries that are accepted or beyond
					// (accepted, picked_up, in_transit, delivered)
					const chatEnabledStatuses = [
						'accepted',
						'picked_up',
						'in_transit',
						'delivered',
					];
					if (chatEnabledStatuses.includes(delivery.status)) {
						setIsVisible(true);

						// Check if chat exists
						const { data: chatData } = await supabase
							.from('delivery_chats')
							.select('id')
							.eq('delivery_id', deliveryId)
							.single();

						if (chatData) {
							// Get unread count
							const { data: unreadMessages } = await supabase
								.from('delivery_messages')
								.select('id')
								.eq('chat_id', chatData.id)
								.eq('is_read', false)
								.neq('sender_id', currentUserId);

							setUnreadCount(unreadMessages?.length || 0);

							// Subscribe to new messages for unread count
							const messagesChannel = supabase
								.channel(`floating-chat-${chatData.id}`)
								.on(
									'postgres_changes',
									{
										event: 'INSERT',
										schema: 'public',
										table: 'delivery_messages',
										filter: `chat_id=eq.${chatData.id}`,
									},
									(payload) => {
										const newMessage = payload.new as any;
										if (
											newMessage.sender_id !== currentUserId &&
											(!showChat || isChatMinimized)
										) {
											setUnreadCount((prev) => prev + 1);
										}
									}
								)
								.on(
									'postgres_changes',
									{
										event: 'UPDATE',
										schema: 'public',
										table: 'delivery_messages',
										filter: `chat_id=eq.${chatData.id}`,
									},
									() => {
										// Refresh unread count when messages are marked as read
										if (!showChat || isChatMinimized) {
											supabase
												.from('delivery_messages')
												.select('id')
												.eq('chat_id', chatData.id)
												.eq('is_read', false)
												.neq('sender_id', currentUserId)
												.then(({ data }) => {
													setUnreadCount(data?.length || 0);
												});
										}
									}
								)
								.subscribe();

							return () => {
								messagesChannel.unsubscribe();
							};
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
	}, [deliveryId, currentUserId, showChat, isChatMinimized, supabase]);

	// Reset unread count when chat is opened
	useEffect(() => {
		if (showChat && !isChatMinimized) {
			setUnreadCount(0);
		}
	}, [showChat, isChatMinimized]);

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
				<div className="flex flex-col items-end space-y-2">
					{/* Quick Call Button (Mobile) */}
					{otherUserPhone && (
						<Button
							onClick={() => window.open(`tel:${otherUserPhone}`)}
							className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg md:hidden"
							size="sm"
						>
							<Phone className="h-5 w-5" />
						</Button>
					)}

					{/* Chat Button */}
					<div className="relative">
						<Button
							onClick={() => setShowChat(true)}
							className="h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-all duration-300 hover:scale-105"
							size="sm"
						>
							<MessageCircle className="h-6 w-6" />
						</Button>
						{unreadCount > 0 && (
							<Badge
								variant="destructive"
								className="absolute -top-2 -right-2 min-w-[24px] h-6 flex items-center justify-center text-xs font-bold animate-pulse"
							>
								{unreadCount > 99 ? '99+' : unreadCount}
							</Badge>
						)}
					</div>
				</div>
			)}

			{/* Chat Component */}
			{showChat && (
				<div className="w-80 md:w-96">
					<DeliveryChat
						deliveryId={deliveryId}
						currentUserId={currentUserId}
						userType={userType}
						isMinimized={isChatMinimized}
						onToggleMinimize={() => setIsChatMinimized((prev) => !prev)}
						onClose={() => setShowChat(false)}
						className="border-0 shadow-2xl"
					/>
				</div>
			)}
		</div>
	);
}
