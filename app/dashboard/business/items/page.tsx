'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Package, Pencil } from 'lucide-react';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatXAF } from '@/lib/utils';

export default function ItemsPage() {
	const [items, setItems] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const supabase = createClient();

	useEffect(() => {
		const fetchItems = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) return;

			// Get business ID
			const { data: business } = await supabase
				.from('businesses')
				.select('id')
				.eq('owner_id', user.id)
				.single();

			if (!business) return;

			// Fetch items
			const { data } = await supabase
				.from('items')
				.select('*')
				.eq('business_id', business.id)
				.order('created_at', { ascending: false });

			if (data) {
				setItems(data);
			}
			setLoading(false);
		};

		fetchItems();
	}, [supabase]);

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-3xl font-bold">Items</h1>
						<p className="text-gray-600">Manage your product inventory</p>
					</div>
					<Button asChild>
						<Link href="/dashboard/business/items/new">
							<Plus className="h-4 w-4 mr-2" />
							Add Item
						</Link>
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>All Items</CardTitle>
					<CardDescription>
						A list of all items in your inventory
					</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="flex items-center justify-center p-8">
							<p className="text-gray-500">Loading items...</p>
						</div>
					) : items.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Price</TableHead>
									<TableHead>Stock</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{items.map((item) => (
									<TableRow key={item.id}>
										<TableCell>
											<div className="flex items-center space-x-3">
												<div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
													{item.image_url ? (
														<img
															src={item.image_url}
															alt={item.name}
															className="w-full h-full object-cover rounded-lg"
														/>
													) : (
														<Package className="h-5 w-5 text-gray-400" />
													)}
												</div>
												<div>
													<p className="font-medium">{item.name}</p>
													{item.description && (
														<p className="text-sm text-gray-500 line-clamp-1">
															{item.description}
														</p>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell>{formatXAF(item.price)}</TableCell>
										<TableCell>{item.stock_quantity}</TableCell>
										<TableCell>
											<Badge
												variant={item.is_available ? 'default' : 'secondary'}
											>
												{item.is_available ? 'Available' : 'Unavailable'}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button asChild variant="outline" size="sm">
												<Link href={`/dashboard/business/items/${item.id}`}>
													<Pencil className="h-4 w-4" />
												</Link>
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<div className="text-center py-12">
							<Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
							<h2 className="text-lg font-semibold mb-2">No items yet</h2>
							<p className="text-gray-600 mb-4">
								Add your first item to start selling
							</p>
							<Button asChild>
								<Link href="/dashboard/business/items/new">
									Add Your First Item
								</Link>
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
