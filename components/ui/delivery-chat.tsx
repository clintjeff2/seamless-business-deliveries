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
} from 'lucide-react';
import { format } from 'date-fns';

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
	profile?: {
		full_name: string;
		avatar_url?: string;
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
}

export function DeliveryChat({
	deliveryId,
	currentUserId,
	userType,
	isMinimized = false,
	onToggleMinimize,
	onClose,
}: DeliveryChatProps) {
	const [chat, setChat] = useState<DeliveryChat | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [participants, setParticipants] = useState<ChatParticipant[]>([]);
	const [newMessage, setNewMessage] = useState('');
	const [isLoading, setIsLoading] = useState(true);
	const [isTyping, setIsTyping] = useState(false);
	const [otherUserTyping, setOtherUserTyping] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const typingTimeoutRef = useRef<NodeJS.Timeout>();
	const supabase = createClient();

	// Scroll to bottom of messages
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	// Load chat data
	useEffect(() => {
		const loadChatData = async () => {
			try {
				setIsLoading(true);

				// Get chat for this delivery
				const { data: chatData, error: chatError } = await supabase
					.from('delivery_chats')
					.select('*')
					.eq('delivery_id', deliveryId)
					.single();

				if (chatError) {
					console.error('Error loading chat:', chatError);
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
						profile:profiles(full_name, avatar_url)
					`
						)
						.eq('chat_id', chatData.id);

				if (participantsError) {
					console.error('Error loading participants:', participantsError);
					return;
				}

				setParticipants(participantsData || []);

				// Mark messages as read
				await supabase.rpc('mark_messages_read', {
					p_chat_id: chatData.id,
					p_user_id: currentUserId,
				});
			} catch (error) {
				console.error('Error in loadChatData:', error);
			} finally {
				setIsLoading(false);
			}
		};

		if (deliveryId && currentUserId) {
			loadChatData();
		}
	}, [deliveryId, currentUserId, supabase]);

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

					// Update unread count if message is from other user
					if (newMessage.sender_id !== currentUserId) {
						setUnreadCount((prev) => prev + 1);
					}

					scrollToBottom();
				}
			)
			.subscribe();

		// Subscribe to typing indicators
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
					}
				}
			)
			.subscribe();

		return () => {
			messagesChannel.unsubscribe();
			typingChannel.unsubscribe();
		};
	}, [chat?.id, currentUserId, supabase]);

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

	if (isLoading) {
		return (
			<Card className="w-full max-w-md">
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
			<Card className="w-full max-w-md">
				<CardContent className="p-4 text-center">
					<MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-2" />
					<p className="text-gray-600">
						Chat will be available once delivery is accepted
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card
			className={`w-full max-w-md transition-all duration-300 ${
				isMinimized ? 'h-16' : 'h-96'
			}`}
		>
			{/* Chat Header */}
			<CardHeader className="p-4 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-3">
						<Avatar className="h-8 w-8">
							<AvatarImage src={otherParticipant?.profile?.avatar_url} />
							<AvatarFallback>
								{otherParticipant?.profile?.full_name?.charAt(0) || 'U'}
							</AvatarFallback>
						</Avatar>
						<div>
							<CardTitle className="text-sm">
								{otherParticipant?.profile?.full_name || 'User'}
							</CardTitle>
							<div className="flex items-center space-x-2">
								<Badge variant="secondary" className="text-xs">
									{otherParticipant?.user_type === 'driver'
										? 'Driver'
										: 'Customer'}
								</Badge>
								{otherUserTyping && (
									<span className="text-xs text-blue-500">typing...</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center space-x-1">
						{unreadCount > 0 && (
							<Badge variant="destructive" className="text-xs">
								{unreadCount}
							</Badge>
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
					<CardContent className="p-0 h-64 overflow-y-auto">
						<div className="p-4 space-y-4">
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
										className={`max-w-[80%] rounded-lg p-3 ${
											message.sender_type === 'system'
												? 'bg-gray-100 text-gray-600 text-center text-sm'
												: message.sender_id === currentUserId
												? 'bg-blue-500 text-white'
												: 'bg-gray-200 text-gray-900'
										}`}
									>
										<p className="text-sm">{message.content}</p>
										<p className="text-xs opacity-70 mt-1">
											{format(new Date(message.created_at), 'HH:mm')}
										</p>
									</div>
								</div>
							))}
							<div ref={messagesEndRef} />
						</div>
					</CardContent>

					{/* Message Input */}
					<div className="p-4 border-t">
						<div className="flex items-center space-x-2">
							<Input
								value={newMessage}
								onChange={(e) => setNewMessage(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder="Type a message..."
								className="flex-1"
								disabled={chat.status !== 'active'}
							/>
							<Button
								onClick={handleSendMessage}
								disabled={!newMessage.trim() || chat.status !== 'active'}
								size="sm"
							>
								<Send className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</>
			)}
		</Card>
	);
}
