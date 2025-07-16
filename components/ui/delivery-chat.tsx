'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
	Send,
	MessageCircle,
	Phone,
	MapPin,
	Image as ImageIcon,
	Smile,
	MoreVertical,
	X,
	Minimize2,
	Maximize2,
	Circle,
	CheckCheck,
	Check,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ChatMessage {
	id: string;
	chat_id: string;
	sender_id: string;
	sender_type: 'customer' | 'driver' | 'system';
	message_type: 'text' | 'image' | 'location' | 'system_notification';
	content: string;
	metadata?: any;
	is_read: boolean;
	created_at: string;
	updated_at: string;
}

interface ChatParticipant {
	id: string;
	user_id: string;
	user_type: 'customer' | 'driver';
	is_typing: boolean;
	last_seen_at: string;
	is_online: boolean;
	profile?: {
		full_name: string;
		avatar_url?: string;
		phone?: string;
	};
}

interface DeliveryChat {
	id: string;
	delivery_id: string;
	customer_id: string;
	driver_id: string;
	status: 'active' | 'ended' | 'archived';
	created_at: string;
	last_message_at: string;
}

interface DeliveryChatProps {
	deliveryId: string;
	currentUserId: string;
	userType: 'customer' | 'driver';
	isMinimized?: boolean;
	onToggleMinimize?: () => void;
	onClose?: () => void;
	className?: string;
}

export function DeliveryChat({
	deliveryId,
	currentUserId,
	userType,
	isMinimized = false,
	onToggleMinimize,
	onClose,
	className = '',
}: DeliveryChatProps) {
	const [chat, setChat] = useState<DeliveryChat | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [participants, setParticipants] = useState<ChatParticipant[]>([]);
	const [newMessage, setNewMessage] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isTyping, setIsTyping] = useState(false);
	const [otherUserTyping, setOtherUserTyping] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const [isOnline, setIsOnline] = useState(true);
	const [connectionRetries, setConnectionRetries] = useState(0);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const typingTimeoutRef = useRef<NodeJS.Timeout>();
	const presenceTimeoutRef = useRef<NodeJS.Timeout>();
	const supabase = createClient();

	// Scroll to bottom of messages
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	// Update user presence
	const updatePresence = async () => {
		if (!chat?.id) return;

		try {
			await supabase.rpc('update_user_presence', {
				p_chat_id: chat.id,
				p_user_id: currentUserId,
				p_is_online: true,
			});
		} catch (error) {
			console.error('Error updating presence:', error);
		}
	};

	// Set up presence heartbeat
	useEffect(() => {
		if (!chat?.id) return;

		// Update presence immediately
		updatePresence();

		// Set up interval to update presence every 30 seconds
		const interval = setInterval(updatePresence, 30000);

		// Update presence when page becomes visible
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				updatePresence();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Clean up on unmount
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', handleVisibilityChange);

			// Mark as offline when component unmounts
			supabase.rpc('update_user_presence', {
				p_chat_id: chat.id,
				p_user_id: currentUserId,
				p_is_online: false,
			});
		};
	}, [chat?.id, currentUserId, supabase]);

	// Load chat data
	useEffect(() => {
		const loadChatData = async () => {
			try {
				setIsLoading(true);
				setConnectionRetries(0);

				// First, check if delivery exists and its status
				const { data: deliveryData, error: deliveryError } = await supabase
					.from('deliveries')
					.select('status, transport_service_id, orders(user_id)')
					.eq('id', deliveryId)
					.single();

				if (deliveryError) {
					console.error('Error loading delivery:', deliveryError);
					return;
				}

				// Only proceed if delivery is accepted or beyond
				const chatEnabledStatuses = [
					'accepted',
					'picked_up',
					'in_transit',
					'delivered',
				];
				if (!chatEnabledStatuses.includes(deliveryData.status)) {
					setIsLoading(false);
					return;
				}

				// Get chat for this delivery
				let { data: chatData, error: chatError } = await supabase
					.from('delivery_chats')
					.select('*')
					.eq('delivery_id', deliveryId)
					.single();

				// If no chat exists but delivery is accepted or beyond, create one
				if (
					chatError &&
					chatError.code === 'PGRST116' &&
					chatEnabledStatuses.includes(deliveryData.status)
				) {
					console.log('Creating new chat for delivery:', deliveryId);

					// Create new chat
					const { data: newChatData, error: createChatError } = await supabase
						.from('delivery_chats')
						.insert([
							{
								delivery_id: deliveryId,
								customer_id: deliveryData.orders.user_id,
								driver_id: deliveryData.transport_service_id,
								status: 'active',
							},
						])
						.select()
						.single();

					if (createChatError) {
						console.error('Error creating chat:', createChatError);
						return;
					}

					chatData = newChatData;
				} else if (chatError) {
					console.error('Error loading chat:', chatError);
					if (connectionRetries < 3) {
						setTimeout(() => {
							setConnectionRetries((prev) => prev + 1);
							loadChatData();
						}, 2000);
					}
					return;
				}

				setChat(chatData);

				// Get messages
				const { data: messagesData, error: messagesError } = await supabase
					.from('delivery_messages')
					.select('*')
					.eq('chat_id', chatData.id)
					.order('created_at', { ascending: true });

				if (messagesError) {
					console.error('Error loading messages:', messagesError);
					return;
				}

				setMessages(messagesData || []);

				// Get participants with profile info and online status
				const { data: participantsData, error: participantsError } =
					await supabase
						.from('delivery_chat_participants')
						.select(
							`
						*,
						profile:profiles(full_name, avatar_url, phone)
					`
						)
						.eq('chat_id', chatData.id);

				if (participantsError) {
					console.error('Error loading participants:', participantsError);
					return;
				}

				setParticipants(participantsData || []);

				// Count unread messages
				const unreadMessages =
					messagesData?.filter(
						(msg) => !msg.is_read && msg.sender_id !== currentUserId
					) || [];
				setUnreadCount(unreadMessages.length);

				// Mark messages as read if chat is not minimized
				if (!isMinimized) {
					await supabase.rpc('mark_messages_read', {
						p_chat_id: chatData.id,
						p_user_id: currentUserId,
					});
					setUnreadCount(0);
				}
			} catch (error) {
				console.error('Error in loadChatData:', error);
			} finally {
				setIsLoading(false);
			}
		};

		if (deliveryId && currentUserId) {
			loadChatData();
		}
	}, [deliveryId, currentUserId, isMinimized, connectionRetries, supabase]);

	// Set up real-time subscriptions
	useEffect(() => {
		if (!chat?.id) return;

		// Subscribe to new messages
		const messagesChannel = supabase
			.channel(`chat-messages-${chat.id}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'delivery_messages',
					filter: `chat_id=eq.${chat.id}`,
				},
				(payload) => {
					const newMessage = payload.new as ChatMessage;
					setMessages((prev) => [...prev, newMessage]);

					// Update unread count if message is from other user and chat is minimized
					if (newMessage.sender_id !== currentUserId && isMinimized) {
						setUnreadCount((prev) => prev + 1);
					}

					// Auto-mark as read if chat is not minimized
					if (!isMinimized && newMessage.sender_id !== currentUserId) {
						setTimeout(() => {
							supabase.rpc('mark_messages_read', {
								p_chat_id: chat.id,
								p_user_id: currentUserId,
							});
						}, 500);
					}

					scrollToBottom();
				}
			)
			.subscribe();

		// Subscribe to message updates (for read status)
		const messageUpdatesChannel = supabase
			.channel(`chat-message-updates-${chat.id}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'delivery_messages',
					filter: `chat_id=eq.${chat.id}`,
				},
				(payload) => {
					const updatedMessage = payload.new as ChatMessage;
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === updatedMessage.id ? updatedMessage : msg
						)
					);
				}
			)
			.subscribe();

		// Subscribe to typing indicators and presence
		const typingChannel = supabase
			.channel(`chat-typing-${chat.id}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'delivery_chat_participants',
					filter: `chat_id=eq.${chat.id}`,
				},
				(payload) => {
					const updatedParticipant = payload.new as any;
					if (updatedParticipant.user_id !== currentUserId) {
						setOtherUserTyping(updatedParticipant.is_typing);

						// Update participant info including online status
						setParticipants((prev) =>
							prev.map((p) =>
								p.user_id === updatedParticipant.user_id
									? { ...p, ...updatedParticipant }
									: p
							)
						);
					}
				}
			)
			.subscribe();

		return () => {
			messagesChannel.unsubscribe();
			messageUpdatesChannel.unsubscribe();
			typingChannel.unsubscribe();
		};
	}, [chat?.id, currentUserId, isMinimized, supabase]);

	// Auto-scroll when new messages arrive
	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Handle typing indicators
	const handleTyping = () => {
		if (!chat?.id) return;

		if (!isTyping) {
			setIsTyping(true);
			supabase.rpc('update_typing_status', {
				p_chat_id: chat.id,
				p_user_id: currentUserId,
				p_is_typing: true,
			});
		}

		// Clear existing timeout
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		// Set new timeout to stop typing indicator
		typingTimeoutRef.current = setTimeout(() => {
			setIsTyping(false);
			supabase.rpc('update_typing_status', {
				p_chat_id: chat.id,
				p_user_id: currentUserId,
				p_is_typing: false,
			});
		}, 2000);
	};

	// Send message
	const handleSendMessage = async () => {
		if (!newMessage.trim() || !chat?.id) return;

		try {
			const messageData = {
				chat_id: chat.id,
				sender_id: currentUserId,
				sender_type: userType,
				message_type: 'text',
				content: newMessage.trim(),
			};

			const { error } = await supabase
				.from('delivery_messages')
				.insert([messageData]);

			if (error) {
				console.error('Error sending message:', error);
				return;
			}

			setNewMessage('');

			// Stop typing indicator
			if (isTyping) {
				setIsTyping(false);
				supabase.rpc('update_typing_status', {
					p_chat_id: chat.id,
					p_user_id: currentUserId,
					p_is_typing: false,
				});
			}
		} catch (error) {
			console.error('Error in handleSendMessage:', error);
		}
	};

	// Handle key press
	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		} else {
			handleTyping();
		}
	};

	// Mark messages as read when chat is opened
	useEffect(() => {
		if (chat?.id && !isMinimized) {
			supabase.rpc('mark_messages_read', {
				p_chat_id: chat.id,
				p_user_id: currentUserId,
			});
			setUnreadCount(0);
		}
	}, [chat?.id, isMinimized, currentUserId, supabase]);

	// Get other participant info
	const otherParticipant = participants.find(
		(p) => p.user_id !== currentUserId
	);

	// Format last seen
	const formatLastSeen = (lastSeen: string) => {
		const lastSeenDate = new Date(lastSeen);
		const now = new Date();
		const diffInMinutes = Math.floor(
			(now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
		);

		if (diffInMinutes < 1) return 'Just now';
		if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
		if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
		return formatDistanceToNow(lastSeenDate, { addSuffix: true });
	};

	// Get online status
	const getOnlineStatus = () => {
		if (!otherParticipant) return { status: 'offline', text: 'Offline' };

		const lastSeenDate = new Date(otherParticipant.last_seen_at);
		const now = new Date();
		const diffInMinutes = Math.floor(
			(now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
		);

		if (otherParticipant.is_online || diffInMinutes < 2) {
			return { status: 'online', text: 'Online' };
		} else if (diffInMinutes < 10) {
			return { status: 'away', text: 'Away' };
		} else {
			return {
				status: 'offline',
				text: `Last seen ${formatLastSeen(otherParticipant.last_seen_at)}`,
			};
		}
	};

	if (isLoading) {
		return (
			<Card className={`w-full ${className}`}>
				<CardContent className="p-4">
					<div className="animate-pulse space-y-4">
						<div className="h-4 bg-gray-200 rounded w-3/4"></div>
						<div className="h-20 bg-gray-200 rounded"></div>
						<div className="h-8 bg-gray-200 rounded"></div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!chat) {
		return (
			<Card className={`w-full ${className}`}>
				<CardContent className="p-4 text-center">
					<MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-2" />
					<p className="text-gray-600 text-sm">
						Chat will be available once delivery is accepted
					</p>
				</CardContent>
			</Card>
		);
	}

	const onlineStatus = getOnlineStatus();

	return (
		<Card
			className={`w-full transition-all duration-300 shadow-lg ${
				isMinimized ? 'h-16' : 'h-96 md:h-[500px]'
			} ${className}`}
		>
			{/* Chat Header */}
			<CardHeader className="p-3 md:p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-3">
						<div className="relative">
							<Avatar className="h-8 w-8 md:h-10 md:w-10">
								<AvatarImage src={otherParticipant?.profile?.avatar_url} />
								<AvatarFallback className="bg-blue-500 text-white">
									{otherParticipant?.profile?.full_name?.charAt(0) || 'U'}
								</AvatarFallback>
							</Avatar>
							{/* Online status indicator */}
							<div
								className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
									onlineStatus.status === 'online'
										? 'bg-green-500'
										: onlineStatus.status === 'away'
										? 'bg-yellow-500'
										: 'bg-gray-400'
								}`}
							/>
						</div>
						<div className="min-w-0 flex-1">
							<CardTitle className="text-sm md:text-base truncate">
								{otherParticipant?.profile?.full_name || 'User'}
							</CardTitle>
							<div className="flex items-center space-x-2">
								<Badge variant="secondary" className="text-xs">
									{otherParticipant?.user_type === 'driver'
										? 'Driver'
										: 'Customer'}
								</Badge>
								{otherUserTyping ? (
									<span className="text-xs text-blue-500 animate-pulse">
										typing...
									</span>
								) : (
									<span
										className={`text-xs ${
											onlineStatus.status === 'online'
												? 'text-green-600'
												: onlineStatus.status === 'away'
												? 'text-yellow-600'
												: 'text-gray-500'
										}`}
									>
										{onlineStatus.text}
									</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center space-x-1">
						{unreadCount > 0 && (
							<Badge variant="destructive" className="text-xs min-w-[20px] h-5">
								{unreadCount > 99 ? '99+' : unreadCount}
							</Badge>
						)}
						{/* Call button for mobile */}
						{otherParticipant?.profile?.phone && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									window.open(`tel:${otherParticipant.profile?.phone}`)
								}
								className="h-8 w-8 p-0 md:hidden"
							>
								<Phone className="h-4 w-4" />
							</Button>
						)}
						{onToggleMinimize && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onToggleMinimize}
								className="h-8 w-8 p-0"
							>
								{isMinimized ? (
									<Maximize2 className="h-4 w-4" />
								) : (
									<Minimize2 className="h-4 w-4" />
								)}
							</Button>
						)}
						{onClose && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onClose}
								className="h-8 w-8 p-0"
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			{/* Chat Messages */}
			{!isMinimized && (
				<>
					<CardContent className="p-0 flex-1 overflow-hidden">
						<div className="h-64 md:h-80 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-gray-50">
							{messages.map((message) => (
								<div
									key={message.id}
									className={`flex ${
										message.sender_id === currentUserId
											? 'justify-end'
											: 'justify-start'
									}`}
								>
									<div
										className={`max-w-[85%] md:max-w-[80%] rounded-lg p-2 md:p-3 ${
											message.sender_type === 'system'
												? 'bg-gray-100 text-gray-600 text-center text-xs md:text-sm mx-auto'
												: message.sender_id === currentUserId
												? 'bg-blue-500 text-white rounded-br-sm'
												: 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
										}`}
									>
										<p className="text-xs md:text-sm break-words">
											{message.content}
										</p>
										<div className="flex items-center justify-between mt-1">
											<p className="text-xs opacity-70">
												{format(new Date(message.created_at), 'HH:mm')}
											</p>
											{message.sender_id === currentUserId &&
												message.sender_type !== 'system' && (
													<div className="ml-2">
														{message.is_read ? (
															<CheckCheck className="h-3 w-3 text-blue-200" />
														) : (
															<Check className="h-3 w-3 text-blue-200" />
														)}
													</div>
												)}
										</div>
									</div>
								</div>
							))}
							<div ref={messagesEndRef} />
						</div>
					</CardContent>

					{/* Message Input */}
					<div className="p-3 md:p-4 border-t bg-white">
						<div className="flex items-center space-x-2">
							<Input
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Type a message..."
								className="flex-1 text-sm"
								disabled={chat.status !== 'active'}
								maxLength={1000}
							/>
							<Button
								onClick={handleSendMessage}
								disabled={!newMessage.trim() || chat.status !== 'active'}
								size="sm"
								className="h-9 w-9 md:h-10 md:w-10 p-0"
							>
								<Send className="h-4 w-4" />
							</Button>
						</div>
						{chat.status !== 'active' && (
							<p className="text-xs text-gray-500 mt-2 text-center">
								Chat has ended
							</p>
						)}
					</div>
				</>
			)}
		</Card>
	);
}
