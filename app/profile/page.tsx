'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { geocodeAddress } from '@/lib/mapbox';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, User } from 'lucide-react';
import type { Profile } from '@/lib/types';

export default function ProfilePage() {
	const [profile, setProfile] = useState<Profile | null>(null);
	const [formData, setFormData] = useState({
		full_name: '',
		phone: '',
		address: '',
		city: '',
		current_password: '',
		new_password: '',
		confirm_password: '',
	});
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const supabase = createClient();

	useEffect(() => {
		const fetchProfile = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				router.push('/login');
				return;
			}

			const { data: profile } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', user.id)
				.single();

			if (profile) {
				setProfile(profile);
				setFormData((prev) => ({
					...prev,
					full_name: profile.full_name || '',
					phone: profile.phone || '',
					address: profile.address || '',
					city: profile.city || '',
				}));
				setImagePreview(profile.avatar_url || null);
			}
		};

		fetchProfile();
	}, [supabase, router]);

	const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setSelectedImage(file);
			const previewUrl = URL.createObjectURL(file);
			setImagePreview(previewUrl);
		}
	};

	const handleProfileUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccessMessage(null);

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			// Upload avatar if changed
			let avatar_url = profile?.avatar_url;
			if (selectedImage) {
				const filePath = `avatars/${user.id}-${Date.now()}`;
				const { error: uploadError } = await supabase.storage
					.from('avatars')
					.upload(filePath, selectedImage);

				if (uploadError) throw uploadError;

				const {
					data: { publicUrl },
				} = supabase.storage.from('avatars').getPublicUrl(filePath);

				avatar_url = publicUrl;
			}

			// Geocode address if provided
			let coordinates = null;
			if (formData.address && formData.city) {
				const fullAddress = `${formData.address}, ${formData.city}`;
				coordinates = await geocodeAddress(fullAddress);
				if (!coordinates) {
					throw new Error(
						'Could not geocode address. Please check the address and try again.'
					);
				}
			}

			// Update profile information
			const { error: profileError } = await supabase
				.from('profiles')
				.update({
					full_name: formData.full_name,
					phone: formData.phone,
					address: formData.address,
					city: formData.city,
					latitude: coordinates?.latitude,
					longitude: coordinates?.longitude,
					avatar_url,
					updated_at: new Date().toISOString(),
				})
				.eq('id', user.id);

			if (profileError) throw profileError;

			// Handle password change if requested
			if (formData.new_password) {
				if (formData.new_password !== formData.confirm_password) {
					throw new Error("New passwords don't match");
				}

				const { error: passwordError } = await supabase.auth.updateUser({
					password: formData.new_password,
				});

				if (passwordError) throw passwordError;
			}

			setSuccessMessage('Profile updated successfully');
			// Clear password fields
			setFormData((prev) => ({
				...prev,
				current_password: '',
				new_password: '',
				confirm_password: '',
			}));
		} catch (error: any) {
			setError(error.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold mb-8">Profile Settings</h1>

				<div className="space-y-6">
					{/* Profile Information */}
					<Card>
						<CardHeader>
							<CardTitle>Profile Information</CardTitle>
							<CardDescription>
								Update your personal information
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleProfileUpdate} className="space-y-6">
								{error && (
									<Alert variant="destructive">
										<AlertDescription>{error}</AlertDescription>
									</Alert>
								)}
								{successMessage && (
									<Alert>
										<AlertDescription>{successMessage}</AlertDescription>
									</Alert>
								)}

								{/* Profile Picture */}
								<div className="flex items-center space-x-4">
									<Avatar className="w-20 h-20">
										<AvatarImage src={imagePreview || undefined} />
										<AvatarFallback>
											<User className="w-8 h-8" />
										</AvatarFallback>
									</Avatar>
									<div>
										<Button
											type="button"
											variant="outline"
											onClick={() => fileInputRef.current?.click()}
										>
											<Upload className="w-4 h-4 mr-2" />
											Change Picture
										</Button>
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											onChange={handleImageSelect}
											className="hidden"
										/>
										<p className="text-sm text-gray-500 mt-1">
											JPG, GIF or PNG. Max size of 2MB.
										</p>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="full_name">Full Name</Label>
										<Input
											id="full_name"
											value={formData.full_name}
											onChange={(e) =>
												setFormData({ ...formData, full_name: e.target.value })
											}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="phone">Phone Number</Label>
										<Input
											id="phone"
											type="tel"
											value={formData.phone}
											onChange={(e) =>
												setFormData({ ...formData, phone: e.target.value })
											}
										/>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="address">Address</Label>
										<Input
											id="address"
											value={formData.address}
											onChange={(e) =>
												setFormData({ ...formData, address: e.target.value })
											}
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="city">City</Label>
										<Input
											id="city"
											value={formData.city}
											onChange={(e) =>
												setFormData({ ...formData, city: e.target.value })
											}
										/>
									</div>
								</div>

								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? 'Updating...' : 'Update Profile'}
								</Button>
							</form>
						</CardContent>
					</Card>

					{/* Password Change */}
					<Card>
						<CardHeader>
							<CardTitle>Change Password</CardTitle>
							<CardDescription>Update your password</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="current_password">Current Password</Label>
									<Input
										id="current_password"
										type="password"
										value={formData.current_password}
										onChange={(e) =>
											setFormData({
												...formData,
												current_password: e.target.value,
											})
										}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="new_password">New Password</Label>
									<Input
										id="new_password"
										type="password"
										value={formData.new_password}
										onChange={(e) =>
											setFormData({ ...formData, new_password: e.target.value })
										}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="confirm_password">Confirm New Password</Label>
									<Input
										id="confirm_password"
										type="password"
										value={formData.confirm_password}
										onChange={(e) =>
											setFormData({
												...formData,
												confirm_password: e.target.value,
											})
										}
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
