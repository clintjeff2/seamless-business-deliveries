import { createClient } from './supabase/server';
import { redirect } from 'next/navigation';
import type { UserRole } from './types';

// Demo user data for when Supabase is not configured
const DEMO_USER = {
	id: 'demo-user-123',
	email: 'demo@example.com',
	profile: {
		id: 'demo-user-123',
		email: 'demo@example.com',
		full_name: 'Demo User',
		phone: '+1234567890',
		role: 'user' as UserRole,
		avatar_url: null,
		address: '123 Demo Street',
		city: 'Demo City',
		latitude: 40.7128,
		longitude: -74.006,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	},
};

// Check if we have valid Supabase configuration
const hasSupabaseConfig = () => {
	return !!(
		process.env.NEXT_PUBLIC_SUPABASE_URL &&
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
	);
};

export async function getUser() {
	// Return demo user immediately if no Supabase config
	if (!hasSupabaseConfig()) {
		return DEMO_USER;
	}

	const supabase = await createClient();

	try {
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();

		if (error || !user) {
			return null;
		}

		// Get user profile
		const { data: profile } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', user.id)
			.single();

		return { ...user, profile };
	} catch (error) {
		console.error('Auth error:', error);
		return null;
	}
}

export async function requireAuth() {
	const user = await getUser();
	if (!user) {
		redirect('/login');
	}
	return user;
}

export async function requireRole(role: UserRole) {
	const user = await requireAuth();
	console.log(user);
	if (user.profile?.role !== role) {
		redirect('/unauthorized');
	}
	return user;
}

export async function signOut() {
	if (!hasSupabaseConfig()) {
		redirect('/login');
		return;
	}

	const supabase = await createClient();
	await supabase.auth.signOut();
	redirect('/login');
}
