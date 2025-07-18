'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	MessageCircle,
	Search,
	Phone,
	ArrowLeft,
	Clock,
	CheckCheck,
	Circle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ChatWithDetails {
	id: string;
	delivery_id: string;
	status: 'active' | 'ended' | 'archived';
	last_message_at: string;
	unread_count: number;
	last_message?: {
		content: string;
		sender_type: 'customer' | 'driver' | 'system';
		created_at: string;
	};
	other_participant?: {
		full_name: string;
		avatar_url?: string;
		phone?: string;
		user_type: 'customer' | 'driver';
		is_online: boolean;
		last_seen_at: string;
	};
	delivery?: {
		status: string;
		orders?: {
			id: string;
			business?: {
				name: string;
			};
		};
	};
}

export default function ChatsPage() {
	const [chats, setChats] = useState<ChatWithDetails[]>([]);
	const [filteredChats, setFilteredChats] = useState<ChatWithDetails[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [loading, setLoading] = useState(true);
	const [currentUser, setCurrentUser] = useState<any>(null);
	const router = useRouter();
	const supabase = createClient();

	useEffect(() => {
		const getCurrentUser = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				router.push('/login');
				return;
			}
			setCurrentUser(user);
		};
		getCurrentUser();
	}, [router, supabase]);

	useEffect(() => {
		if (!currentUser) return;

		const fetchChats = async () => {
			try {
				setLoading(true);

				// Get user's role to determine how to fetch chats
				const { data: profile } = await supabase
					.from('profiles')
					.select('role')
					.eq('id', currentUser.id)
					.single();

				if (!profile) return;

				// Fetch chats based on user role
				const { data: chatsData, error } = await supabase
					.from('delivery_chats')
					.select(
						`
						*,
						delivery:deliveries(
							status,
							orders(
								id,
								business:businesses(name),
								customer:profiles!orders_user_id_fkey(full_name, avatar_url, phone)
							),
							transport_service:transport_services(
								driver:profiles!transport_services_driver_id_fkey(full_name, avatar_url, phone)
							)
						),
						participants:delivery_chat_participants(
							user_id,
							user_type,
							is_online,
							last_seen_at,
							profile:profiles!delivery_chat_participants_user_id_fkey(full_name, avatar_url, phone)
						),
						last_message:delivery_messages(
							content,
							sender_type,
							created_at
						)
					`
					)
					.eq(
						profile.role === 'transport' ? 'driver_id' : 'customer_id',
						currentUser.id
					)
					.order('last_message_at', { ascending: false });

				if (error) throw error;

				// Process and format chat data
				const processedChats = await Promise.all(
					(chatsData || []).map(async (chat: any) => {
						// Get unread count
						const { count: unreadCount } = await supabase
							.from('delivery_messages')
							.select('*', { count: 'exact', head: true })
							.eq('chat_id', chat.id)
							.eq('is_read', false)
							.neq('sender_id', currentUser.id);

						// Get other participant
						const otherParticipant = chat.participants?.find(
							(p: any) => p.user_id !== currentUser.id
						);

						// Get last message
						const { data: lastMessage } = await supabase
							.from('delivery_messages')
							.select('content, sender_type, created_at')
							.eq('chat_id', chat.id)
							.order('created_at', { ascending: false })
							.limit(1)
							.single();

						return {
							...chat,
							unread_count: unreadCount || 0,
							last_message: lastMessage,
							other_participant: otherParticipant
								? {
										...otherParticipant.profile,
										user_type: otherParticipant.user_type,
										is_online: otherParticipant.is_online,
										last_seen_at: otherParticipant.last_seen_at,
								  }
								: null,
						};
					})
				);

				setChats(processedChats);
				setFilteredChats(processedChats);
			} catch (error) {
				console.error('Error fetching chats:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchChats();

		// Set up real-time subscription for chat updates
		const chatsChannel = supabase
			.channel('user-chats')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'delivery_messages',
				},
				(payload) => {
					console.log('Message update received in chats page:', payload);
					// Refresh chats when new messages arrive or are updated
					fetchChats();
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'delivery_chat_participants',
				},
				(payload) => {
					console.log('Participant update received in chats page:', payload);
					// Update participant presence status
					const updatedParticipant = payload.new as any;
					setChats((prevChats) =>
						prevChats.map((chat) => {
							if (
								chat.other_participant?.user_id === updatedParticipant.user_id
							) {
								return {
									...chat,
									other_participant: {
										...chat.other_participant,
										is_online: updatedParticipant.is_online,
										last_seen_at: updatedParticipant.last_seen_at,
									},
								};
							}
							return chat;
						})
					);
				}
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'delivery_chats',
				},
				(payload) => {
					console.log('Chat update received in chats page:', payload);
					// Refresh chats when chat status changes
					fetchChats();
				}
			)
			.subscribe((status) => {
				console.log('Chats page subscription status:', status);
			});

		return () => {
			chatsChannel.unsubscribe();
		};
	}, [currentUser, supabase]);

	// Filter chats based on search term
	useEffect(() => {
		if (!searchTerm) {
			setFilteredChats(chats);
		} else {
			const filtered = chats.filter(
				(chat) =>
					chat.other_participant?.full_name
						?.toLowerCase()
						.includes(searchTerm.toLowerCase()) ||
					chat.delivery?.orders?.business?.name
						?.toLowerCase()
						.includes(searchTerm.toLowerCase()) ||
					chat.delivery?.orders?.id
						?.toLowerCase()
						.includes(searchTerm.toLowerCase())
			);
			setFilteredChats(filtered);
		}
	}, [chats, searchTerm]);

	const getOnlineStatus = (participant: any) => {
		if (!participant) return 'offline';

		const lastSeenDate = new Date(participant.last_seen_at);
		const now = new Date();
		const diffInMinutes = Math.floor(
			(now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
		);

		if (participant.is_online || diffInMinutes < 2) return 'online';
		if (diffInMinutes < 10) return 'away';
		return 'offline';
	};

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

	if (loading) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-2xl mx-auto">
					<div className="animate-pulse space-y-4">
						{[...Array(5)].map((_, i) => (
							<div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="flex items-center space-x-4 mb-6">
					<Button variant="ghost" size="sm" onClick={() => router.back()}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back
					</Button>
					<div>
						<h1 className="text-2xl font-bold">Messages</h1>
						<p className="text-gray-600 text-sm">
							{chats.length} conversation{chats.length !== 1 ? 's' : ''}
						</p>
					</div>
				</div>

				{/* Search */}
				<div className="relative mb-6">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
					<Input
						placeholder="Search conversations..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-10"
					/>
				</div>

				{/* Chat List */}
				<div className="space-y-2">
					{filteredChats.length > 0 ? (
						filteredChats.map((chat) => {
							const onlineStatus = getOnlineStatus(chat.other_participant);

							return (
								<Card
									key={chat.id}
									className="cursor-pointer hover:shadow-md transition-shadow"
									onClick={() =>
										router.push(`/delivery/${chat.delivery_id}/track`)
									}
								>
									<CardContent className="p-4">
										<div className="flex items-center space-x-4">
											{/* Avatar with online status */}
											<div className="relative">
												<Avatar className="h-12 w-12">
													<AvatarImage
														src={chat.other_participant?.avatar_url}
													/>
													<AvatarFallback className="bg-blue-500 text-white">
														{chat.other_participant?.full_name?.charAt(0) ||
															'U'}
													</AvatarFallback>
												</Avatar>
												<div
													className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
														onlineStatus === 'online'
															? 'bg-green-500'
															: onlineStatus === 'away'
															? 'bg-yellow-500'
															: 'bg-gray-400'
													}`}
												/>
											</div>

											{/* Chat Info */}
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<h3 className="font-semibold truncate">
														{chat.other_participant?.full_name || 'User'}
													</h3>
													<div className="flex items-center space-x-2">
														{chat.unread_count > 0 && (
															<Badge variant="destructive" className="text-xs">
																{chat.unread_count > 99
																	? '99+'
																	: chat.unread_count}
															</Badge>
														)}
														<span className="text-xs text-gray-500">
															{chat.last_message_at &&
																format(new Date(chat.last_message_at), 'MMM d')}
														</span>
													</div>
												</div>

												<div className="flex items-center justify-between mt-1">
													<div className="flex items-center space-x-2">
														<Badge variant="secondary" className="text-xs">
															{chat.other_participant?.user_type === 'driver'
																? 'Driver'
																: 'Customer'}
														</Badge>
														<span
															className={`text-xs ${
																onlineStatus === 'online'
																	? 'text-green-600'
																	: onlineStatus === 'away'
																	? 'text-yellow-600'
																	: 'text-gray-500'
															}`}
														>
															{onlineStatus === 'online'
																? 'Online'
																: onlineStatus === 'away'
																? 'Away'
																: `Last seen ${formatLastSeen(
																		chat.other_participant?.last_seen_at || ''
																  )}`}
														</span>
													</div>
												</div>

												{/* Last message preview */}
												{chat.last_message && (
													<p className="text-sm text-gray-600 truncate mt-1">
														{chat.last_message.sender_type === 'system' ? (
															<span className="italic">
																{chat.last_message.content}
															</span>
														) : (
															chat.last_message.content
														)}
													</p>
												)}

												{/* Order info */}
												{chat.delivery?.orders && (
													<p className="text-xs text-gray-500 mt-1">
														Order #{chat.delivery.orders.id.slice(0, 8)} •{' '}
														{chat.delivery.orders.business?.name}
													</p>
												)}
											</div>

											{/* Quick actions */}
											<div className="flex flex-col space-y-2">
												{chat.other_participant?.phone && (
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0"
														onClick={(e) => {
															e.stopPropagation();
															window.open(
																`tel:${chat.other_participant?.phone}`
															);
														}}
													>
														<Phone className="h-4 w-4" />
													</Button>
												)}
												<div
													className={`w-3 h-3 rounded-full ${
														chat.status === 'active'
															? 'bg-green-500'
															: 'bg-gray-400'
													}`}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})
					) : (
						<Card>
							<CardContent className="p-8 text-center">
								<MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
								<h3 className="text-lg font-semibold mb-2">No conversations</h3>
								<p className="text-gray-600">
									{searchTerm
										? 'No chats match your search.'
										: 'Start a delivery to begin chatting with customers or drivers.'}
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
