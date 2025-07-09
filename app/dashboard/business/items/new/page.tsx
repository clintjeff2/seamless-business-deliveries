'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Image, Upload } from 'lucide-react';

export default function NewItemPage() {
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		price: '',
		stock_quantity: '',
		is_available: true,
	});
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const supabase = createClient();

	const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setSelectedImage(file);
			// Create preview URL
			const previewUrl = URL.createObjectURL(file);
			setImagePreview(previewUrl);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			// Get business ID
			const { data: business } = await supabase
				.from('businesses')
				.select('id')
				.eq('owner_id', user.id)
				.single();

			if (!business) throw new Error('Business not found');

			let image_url = null;

			// Upload image if selected
			if (selectedImage) {
				const fileExt = selectedImage.name.split('.').pop();
				const fileName = `${crypto.randomUUID()}.${fileExt}`;
				const filePath = `items/${fileName}`;

				const { error: uploadError, data } = await supabase.storage
					.from('items')
					.upload(filePath, selectedImage);

				if (uploadError) throw uploadError;

				// Get public URL
				const {
					data: { publicUrl },
				} = supabase.storage.from('items').getPublicUrl(filePath);

				image_url = publicUrl;
			}

			// Create item
			const { error: itemError } = await supabase.from('items').insert({
				business_id: business.id,
				name: formData.name,
				description: formData.description,
				price: Number(formData.price),
				image_url,
				stock_quantity: Number(formData.stock_quantity),
				is_available: formData.is_available,
			});

			if (itemError) throw itemError;

			router.push('/dashboard/business');
		} catch (error: any) {
			setError(error.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<Card>
					<CardHeader>
						<CardTitle>Add New Item</CardTitle>
						<CardDescription>
							Add a new item to your business inventory
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}

							<div className="space-y-2">
								<Label htmlFor="name">Item Name *</Label>
								<Input
									id="name"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
									placeholder="Describe your item..."
								/>
							</div>

							<div className="grid md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="price">Price *</Label>
									<Input
										id="price"
										type="number"
										step="0.01"
										value={formData.price}
										onChange={(e) =>
											setFormData({ ...formData, price: e.target.value })
										}
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="stock">Stock Quantity *</Label>
									<Input
										id="stock"
										type="number"
										value={formData.stock_quantity}
										onChange={(e) =>
											setFormData({
												...formData,
												stock_quantity: e.target.value,
											})
										}
										required
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Item Image</Label>
								<div className="flex items-center space-x-4">
									<div
										className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-50"
										onClick={() => fileInputRef.current?.click()}
									>
										{imagePreview ? (
											<img
												src={imagePreview}
												alt="Preview"
												className="w-full h-full object-cover rounded-lg"
											/>
										) : (
											<div className="text-center">
												<Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
												<span className="text-sm text-gray-500">
													Upload Image
												</span>
											</div>
										)}
									</div>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										onChange={handleImageSelect}
										className="hidden"
									/>
									{imagePreview && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => {
												setSelectedImage(null);
												setImagePreview(null);
												if (fileInputRef.current) {
													fileInputRef.current.value = '';
												}
											}}
										>
											Remove Image
										</Button>
									)}
								</div>
							</div>

							<div className="flex items-center space-x-2">
								<Switch
									checked={formData.is_available}
									onCheckedChange={(checked) =>
										setFormData({ ...formData, is_available: checked })
									}
								/>
								<Label>Available for Purchase</Label>
							</div>

							<Button type="submit" className="w-full" disabled={loading}>
								{loading ? 'Adding Item...' : 'Add Item'}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
