export type UserRole = 'user' | 'business' | 'transport' | 'admin';
export type BusinessCategory =
	| 'restaurants'
	| 'electronics'
	| 'clothing'
	| 'fashion';
export type DeliveryStatus =
	| 'pending'
	| 'accepted'
	| 'picked_up'
	| 'in_transit'
	| 'delivered'
	| 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type TransportStatus = 'available' | 'busy' | 'offline';

export interface Profile {
	id: string;
	email: string;
	full_name?: string;
	phone?: string;
	role: UserRole;
	avatar_url?: string;
	address?: string;
	city?: string;
	latitude?: number;
	longitude?: number;
	created_at: string;
	updated_at: string;
}

export interface Category {
	id: string;
	name: string;
	slug: BusinessCategory;
	description?: string;
	icon?: string;
	created_at: string;
}

export interface Business {
	id: string;
	owner_id: string;
	name: string;
	description?: string;
	category_id: string;
	address: string;
	city: string;
	latitude?: number;
	longitude?: number;
	phone?: string;
	email?: string;
	website?: string;
	logo_url?: string;
	cover_image_url?: string;
	is_active: boolean;
	rating: number;
	total_reviews: number;
	created_at: string;
	updated_at: string;
	category?: Category;
}

export interface Item {
	id: string;
	business_id: string;
	name: string;
	description?: string;
	price: number;
	image_url?: string;
	category?: string;
	is_available: boolean;
	stock_quantity: number;
	created_at: string;
	updated_at: string;
	business?: Business;
}

export interface TransportService {
	id: string;
	driver_id: string;
	service_name: string;
	vehicle_type: string;
	license_plate?: string;
	phone: string;
	base_rate: number;
	per_km_rate: number;
	status: TransportStatus;
	current_latitude?: number;
	current_longitude?: number;
	rating: number;
	total_deliveries: number;
	is_verified: boolean;
	created_at: string;
	updated_at: string;
	driver?: Profile;
}

export interface Order {
	id: string;
	user_id: string;
	business_id: string;
	total_amount: number;
	delivery_address: string;
	delivery_phone?: string;
	delivery_notes?: string;
	status: OrderStatus;
	created_at: string;
	updated_at: string;
	business?: Business;
	order_items?: OrderItem[];
	delivery?: Delivery[];
}

export interface OrderItem {
	id: string;
	order_id: string;
	item_id: string;
	quantity: number;
	price: number;
	created_at: string;
	item?: Item;
}

export interface Delivery {
	id: string;
	order_id: string;
	transport_service_id?: string;
	pickup_address: string;
	pickup_latitude?: number;
	pickup_longitude?: number;
	delivery_address: string;
	delivery_latitude?: number;
	delivery_longitude?: number;
	current_latitude?: number;
	current_longitude?: number;
	status: DeliveryStatus;
	estimated_delivery_time?: string;
	actual_delivery_time?: string;
	delivery_fee?: number;
	distance_km?: number;
	driver_notes?: string;
	created_at: string;
	updated_at: string;
	transport_service?: TransportService;
	orders?: Order;
}

export interface Review {
	id: string;
	user_id: string;
	business_id?: string;
	transport_service_id?: string;
	order_id: string;
	rating: number;
	comment?: string;
	created_at: string;
	user?: Profile;
}

export interface CartItem {
	item: Item;
	quantity: number;
}
