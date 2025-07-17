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
	Loader2,
	Zap,
	MessageSquare,
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
	const [connectionRetries, setConnectionRetries] = useState(0);
	const [isSending, setIsSending] = useState(false);
	const [isConnected, setIsConnected] = useState(true);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const typingTimeoutRef = useRef<NodeJS.Timeout>();
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const supabase = createClient();

	// Scroll to bottom of messages
	const scrollToBottom = () => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	};

	// Update user presence with better error handling
	const updatePresence = async () => {
		if (!chat?.id) return;

		try {
			const { error } = await supabase.rpc('update_user_presence', {
				p_chat_id: chat.id,
				p_user_id: currentUserId,
				p_is_online: true,
			});

			if (error) throw error;
			setIsConnected(true);
		} catch (error) {
			console.error('Error updating presence:', error);
			setIsConnected(false);
		}
	};

	// Set up presence heartbeat with improved error handling
	useEffect(() => {
		if (!chat?.id) return;

		updatePresence();

		const interval = setInterval(updatePresence, 30000);

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				updatePresence();
			}
		};

		const handleFocus = () => updatePresence();
		const handleBlur = () => {
			if (chat?.id) {
				supabase.rpc('update_user_presence', {
					p_chat_id: chat.id,
					p_user_id: currentUserId,
					p_is_online: false,
				});
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);
		window.addEventListener('blur', handleBlur);

		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('blur', handleBlur);

			if (chat?.id) {
				supabase.rpc('update_user_presence', {
					p_chat_id: chat.id,
					p_user_id: currentUserId,
					p_is_online: false,
				});
			}
		};
	}, [chat?.id, currentUserId, supabase]);

	// Load chat data with improved error handling
	useEffect(() => {
		const loadChatData = async () => {
			try {
				setIsLoading(true);
				setConnectionRetries(0);

				// First, check if delivery exists and its status
				const { data: deliveryData, error: deliveryError } = await supabase
					.from('deliveries')
					.select(
						`
						status, 
						transport_service_id, 
						orders(user_id),
						transport_service:transport_services(
							driver:profiles!transport_services_driver_id_fkey(id, full_name, avatar_url, phone)
						)
					`
					)
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

				// Get or create chat for this delivery
				let { data: chatData, error: chatError } = await supabase
					.from('delivery_chats')
					.select('*')
					.eq('delivery_id', deliveryId)
					.single();

				// If no chat exists but delivery is accepted or beyond, create one
				if (chatError && chatError.code === 'PGRST116') {
					console.log('Creating new chat for delivery:', deliveryId);

					const { data: newChatData, error: createChatError } = await supabase
						.from('delivery_chats')
						.insert([
							{
								delivery_id: deliveryId,
								customer_id: deliveryData.orders.user_id,
								driver_id: deliveryData.transport_service?.driver?.id,
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

				// Get participants with profile info
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
				if (!isMinimized && unreadMessages.length > 0) {
					await supabase.rpc('mark_messages_read', {
						p_chat_id: chatData.id,
						p_user_id: currentUserId,
					});
					setUnreadCount(0);
				}

				setIsConnected(true);
			} catch (error) {
				console.error('Error in loadChatData:', error);
				setIsConnected(false);
			} finally {
				setIsLoading(false);
			}
		};

		if (deliveryId && currentUserId) {
			loadChatData();
		}
	}, [deliveryId, currentUserId, isMinimized, connectionRetries, supabase]);

	// Set up real-time subscriptions with improved error handling and automatic reconnection
	useEffect(() => {
		if (!chat?.id) return;

		console.log('Setting up real-time subscriptions for chat:', chat.id);

		// Subscribe to new messages and updates with retry logic
		const messagesChannel = supabase
			.channel(`chat-messages-${chat.id}-${Date.now()}`, {
				config: {
					broadcast: { self: false },
					presence: { key: currentUserId },
				},
			})
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'delivery_messages',
					filter: `chat_id=eq.${chat.id}`,
				},
				(payload) => {
					console.log('New message received:', payload);
					const newMessage = payload.new as ChatMessage;

					setMessages((prev) => {
						// Prevent duplicate messages
						if (prev.find((msg) => msg.id === newMessage.id)) {
							return prev;
						}
						return [...prev, newMessage];
					});

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

					// Scroll to bottom with a small delay for better UX
					setTimeout(scrollToBottom, 100);
				}
			)
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
			.subscribe((status) => {
				console.log('Subscription status:', status);
				if (status === 'SUBSCRIBED') {
					setIsConnected(true);
				} else if (status === 'CHANNEL_ERROR') {
					setIsConnected(false);
					// Retry connection after 3 seconds
					setTimeout(() => {
						if (chat?.id) {
							loadChatData();
						}
					}, 3000);
				}
			});

		return () => {
			console.log('Unsubscribing from chat:', chat.id);
			messagesChannel.unsubscribe();
		};
	}, [chat?.id, currentUserId, isMinimized, supabase]);

	// Auto-scroll when new messages arrive
	useEffect(() => {
		const timer = setTimeout(scrollToBottom, 100);
		return () => clearTimeout(timer);
	}, [messages]);

	// Handle typing indicators with debouncing
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
		}, 1500);
	};

	// Send message with better error handling
	const handleSendMessage = async () => {
		if (!newMessage.trim() || !chat?.id || isSending) return;

		const messageContent = newMessage.trim();
		setNewMessage('');
		setIsSending(true);

		try {
			const messageData = {
				chat_id: chat.id,
				sender_id: currentUserId,
				sender_type: userType,
				message_type: 'text' as const,
				content: messageContent,
			};

			const { error } = await supabase
				.from('delivery_messages')
				.insert([messageData]);

			if (error) {
				console.error('Error sending message:', error);
				// Restore message on error
				setNewMessage(messageContent);
				return;
			}

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
			setNewMessage(messageContent);
		} finally {
			setIsSending(false);
		}
	};

	// Handle key press
	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		} else if (e.key !== 'Enter') {
			handleTyping();
		}
	};

	// Mark messages as read when chat is opened
	useEffect(() => {
		if (chat?.id && !isMinimized && unreadCount > 0) {
			const timer = setTimeout(() => {
				supabase.rpc('mark_messages_read', {
					p_chat_id: chat.id,
					p_user_id: currentUserId,
				});
				setUnreadCount(0);
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [chat?.id, isMinimized, unreadCount, currentUserId, supabase]);

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
			<Card className={`${className} animate-pulse`}>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div className="h-10 w-10 bg-gray-200 rounded-full"></div>
							<div>
								<div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
								<div className="h-3 bg-gray-200 rounded w-16"></div>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="h-8 bg-gray-200 rounded"></div>
						<div className="h-8 bg-gray-200 rounded w-3/4"></div>
						<div className="h-8 bg-gray-200 rounded w-1/2"></div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!chat) {
		return (
			<Card className={`${className} border-orange-200 bg-orange-50`}>
				<CardContent className="p-6 text-center">
					<MessageSquare className="h-12 w-12 text-orange-400 mx-auto mb-3" />
					<h3 className="font-semibold text-orange-800 mb-2">
						Chat Not Available
					</h3>
					<p className="text-sm text-orange-600">
						Chat will be available once the delivery is accepted by a driver.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card
			className={`${className} shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm`}
		>
			{/* Enhanced Header */}
			<CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-3">
						{/* Enhanced Avatar with online status */}
						<div className="relative">
							<Avatar className="h-10 w-10 border-2 border-white/20">
								<AvatarImage src={otherParticipant?.profile?.avatar_url} />
								<AvatarFallback className="bg-white/20 text-white font-semibold">
									{otherParticipant?.profile?.full_name?.charAt(0) || 'U'}
								</AvatarFallback>
							</Avatar>
							<div
								className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
									otherParticipant?.is_online
										? 'bg-green-400 animate-pulse'
										: 'bg-gray-400'
								}`}
							/>
						</div>

						{/* Enhanced User Info */}
						<div className="flex-1 min-w-0">
							<div className="flex items-center space-x-2">
								<h3 className="font-semibold text-white truncate">
									{otherParticipant?.profile?.full_name || 'User'}
								</h3>
								<Badge
									variant="secondary"
									className="text-xs bg-white/20 text-white border-white/30"
								>
									{otherParticipant?.user_type === 'driver'
										? 'Driver'
										: 'Customer'}
								</Badge>
							</div>
							<div className="flex items-center space-x-2 text-white/80 text-xs">
								<Circle
									className={`h-2 w-2 ${
										otherParticipant?.is_online
											? 'text-green-300'
											: 'text-gray-300'
									}`}
									fill="currentColor"
								/>
								<span>
									{otherParticipant?.is_online
										? 'Online'
										: `Last seen ${formatLastSeen(
												otherParticipant?.last_seen_at || ''
										  )}`}
								</span>
								{!isConnected && (
									<Badge variant="destructive" className="text-xs">
										Reconnecting...
									</Badge>
								)}
							</div>
						</div>
					</div>

					{/* Enhanced Action Buttons */}
					<div className="flex items-center space-x-2">
						{/* Call Button */}
						{otherParticipant?.profile?.phone && (
							<Button
								size="sm"
								variant="ghost"
								className="h-8 w-8 p-0 text-white hover:bg-white/20"
								onClick={() =>
									window.open(`tel:${otherParticipant.profile?.phone}`)
								}
							>
								<Phone className="h-4 w-4" />
							</Button>
						)}

						{/* Minimize/Maximize Button */}
						{onToggleMinimize && (
							<Button
								size="sm"
								variant="ghost"
								className="h-8 w-8 p-0 text-white hover:bg-white/20"
								onClick={onToggleMinimize}
							>
								{isMinimized ? (
									<Maximize2 className="h-4 w-4" />
								) : (
									<Minimize2 className="h-4 w-4" />
								)}
							</Button>
						)}

						{/* Close Button */}
						{onClose && (
							<Button
								size="sm"
								variant="ghost"
								className="h-8 w-8 p-0 text-white hover:bg-red-500/20"
								onClick={onClose}
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			{/* Enhanced Messages Container */}
			{!isMinimized && (
				<CardContent className="p-0">
					{/* Messages Area with improved styling */}
					<div
						ref={chatContainerRef}
						className="h-96 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/30 to-white"
						style={{
							scrollBehavior: 'smooth',
							background: 'linear-gradient(to bottom, #f8fafc, #ffffff)',
						}}
					>
						{messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-gray-500">
								<MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
								<p className="text-sm font-medium">No messages yet</p>
								<p className="text-xs">Start the conversation!</p>
							</div>
						) : (
							messages.map((message) => (
								<div
									key={message.id}
									className={`flex ${
										message.sender_id === currentUserId
											? 'justify-end'
											: 'justify-start'
									} animate-in slide-in-from-bottom duration-300`}
								>
									{message.sender_type === 'system' ? (
										<div className="mx-auto">
											<Badge
												variant="secondary"
												className="text-xs bg-blue-100 text-blue-800 border-blue-200"
											>
												{message.content}
											</Badge>
										</div>
									) : (
										<div
											className={`max-w-xs lg:max-w-md ${
												message.sender_id === currentUserId
													? 'order-1'
													: 'order-2'
											}`}
										>
											{/* Enhanced Message Bubble */}
											<div
												className={`px-4 py-3 rounded-2xl shadow-sm ${
													message.sender_id === currentUserId
														? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-md'
														: 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
												} transform transition-all duration-200 hover:scale-[1.02]`}
											>
												<p className="text-sm leading-relaxed">
													{message.content}
												</p>

												{/* Enhanced Message Footer */}
												<div
													className={`flex items-center justify-between mt-2 text-xs ${
														message.sender_id === currentUserId
															? 'text-white/70'
															: 'text-gray-500'
													}`}
												>
													<span>
														{format(new Date(message.created_at), 'HH:mm')}
													</span>
													{message.sender_id === currentUserId && (
														<div className="flex items-center space-x-1">
															{message.is_read ? (
																<CheckCheck className="h-3 w-3 text-blue-200" />
															) : (
																<Check className="h-3 w-3 text-white/50" />
															)}
														</div>
													)}
												</div>
											</div>
										</div>
									)}
								</div>
							))
						)}

						{/* Enhanced Typing Indicator */}
						{otherUserTyping && (
							<div className="flex justify-start animate-in slide-in-from-bottom duration-300">
								<div className="max-w-xs">
									<div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
										<div className="flex items-center space-x-1">
											<div className="flex space-x-1">
												<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
												<div
													className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
													style={{ animationDelay: '0.1s' }}
												></div>
												<div
													className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
													style={{ animationDelay: '0.2s' }}
												></div>
											</div>
											<span className="text-xs text-gray-500 ml-2">
												typing...
											</span>
										</div>
									</div>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Enhanced Input Area */}
					<div className="p-4 border-t bg-white/80 backdrop-blur-sm">
						<div className="flex items-center space-x-3">
							<div className="flex-1">
								<div className="relative">
									<Input
										value={newMessage}
										onChange={(e) => {
											setNewMessage(e.target.value);
											handleTyping();
										}}
										onKeyPress={handleKeyPress}
										placeholder="Type your message..."
										className="pr-12 rounded-full border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
										disabled={isSending}
									/>
									{/* Send Button */}
									<Button
										size="sm"
										onClick={handleSendMessage}
										disabled={!newMessage.trim() || isSending}
										className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
									>
										{isSending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Send className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>
						</div>

						{/* Connection Status */}
						{!isConnected && (
							<div className="mt-2 flex items-center justify-center">
								<Badge variant="destructive" className="text-xs animate-pulse">
									<Zap className="h-3 w-3 mr-1" />
									Reconnecting to chat...
								</Badge>
							</div>
						)}
					</div>
				</CardContent>
			)}

			{/* Minimized View with unread count */}
			{isMinimized && unreadCount > 0 && (
				<div className="absolute -top-2 -right-2">
					<Badge
						variant="destructive"
						className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs animate-pulse"
					>
						{unreadCount > 99 ? '99+' : unreadCount}
					</Badge>
				</div>
			)}
		</Card>
	);
}
