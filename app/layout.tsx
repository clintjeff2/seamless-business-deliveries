import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Navbar } from '@/components/layout/navbar';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'DeliveryHub - Material Tracking & Delivery Platform',
	description:
		'Connect businesses, customers, and transport services for seamless delivery tracking',
	generator: 'v0.dev',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={inter.className}>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem={true}
					disableTransitionOnChange={false}
				>
					<Navbar />
					<main className="min-h-screen">{children}</main>
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
