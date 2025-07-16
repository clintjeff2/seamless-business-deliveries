'use client';

import type React from 'react';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { geocodeAddress } from '@/lib/mapbox';

export default function TransportRegistrationPage() {
	const [formData, setFormData] = useState({
		service_name: '',
		vehicle_type: '',
		license_plate: '',
		phone: '',
		base_rate: '',
		per_km_rate: '',
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const supabase = createClient();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			// Get profile for initial address
			const { data: profile } = await supabase
				.from('profiles')
				.select('address, city')
				.eq('id', user.id)
				.single();

			if (!profile?.address || !profile?.city) {
				throw new Error('Please update your profile with an address first');
			}

			// Geocode the transport service's initial location
			const fullAddress = `${profile.address}, ${profile.city}`;
			const coordinates = await geocodeAddress(fullAddress);
			if (!coordinates) {
				throw new Error(
					'Could not geocode address. Please check your profile address and try again.'
				);
			}

			const { error } = await supabase.from('transport_services').insert({
				driver_id: user.id,
				service_name: formData.service_name,
				vehicle_type: formData.vehicle_type,
				license_plate: formData.license_plate,
				phone: formData.phone,
				base_rate: Number.parseFloat(formData.base_rate),
				per_km_rate: Number.parseFloat(formData.per_km_rate),
				current_latitude: coordinates.latitude,
				current_longitude: coordinates.longitude,
				status: 'offline',
			});

			if (error) throw error;

			router.push('/dashboard/transport');
		} catch (error: any) {
			setError(error.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container mx-auto px-4 py-16">
			<div className="max-w-2xl mx-auto">
				<Card>
					<CardHeader>
						<CardTitle>Register as Transport Service</CardTitle>
						<CardDescription>
							Set up your delivery service profile to start earning
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
								<Label htmlFor="service_name">Service Name *</Label>
								<Input
									id="service_name"
									value={formData.service_name}
									onChange={(e) =>
										setFormData({ ...formData, service_name: e.target.value })
									}
									placeholder="e.g., Quick Delivery Service"
									required
								/>
							</div>

							<div className="grid md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="vehicle_type">Vehicle Type *</Label>
									<Select
										value={formData.vehicle_type}
										onValueChange={(value) =>
											setFormData({ ...formData, vehicle_type: value })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select vehicle" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="motorcycle">🏍️ Motorcycle</SelectItem>
											<SelectItem value="car">🚗 Car</SelectItem>
											<SelectItem value="van">🚐 Van</SelectItem>
											<SelectItem value="truck">🚚 Truck</SelectItem>
											<SelectItem value="bicycle">🚲 Bicycle</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="license_plate">License Plate</Label>
									<Input
										id="license_plate"
										value={formData.license_plate}
										onChange={(e) =>
											setFormData({
												...formData,
												license_plate: e.target.value,
											})
										}
										placeholder="ABC-1234"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="phone">Phone Number *</Label>
								<Input
									id="phone"
									type="tel"
									value={formData.phone}
									onChange={(e) =>
										setFormData({ ...formData, phone: e.target.value })
									}
									required
								/>
							</div>

							<div className="grid md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="base_rate">Base Rate (XAF) *</Label>
									<Input
										id="base_rate"
										type="number"
										step="1"
										value={formData.base_rate}
										onChange={(e) =>
											setFormData({ ...formData, base_rate: e.target.value })
										}
										placeholder="3000"
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="per_km_rate">Rate per KM (XAF) *</Label>
									<Input
										id="per_km_rate"
										type="number"
										step="1"
										value={formData.per_km_rate}
										onChange={(e) =>
											setFormData({ ...formData, per_km_rate: e.target.value })
										}
										placeholder="900"
										required
									/>
								</div>
							</div>

							<Button type="submit" className="w-full" disabled={loading}>
								{loading ? 'Creating Profile...' : 'Complete Registration'}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
