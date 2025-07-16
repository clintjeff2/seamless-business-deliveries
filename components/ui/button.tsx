import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transform-gpu hover:scale-[1.02] active:scale-[0.98]',
	{
		variants: {
			variant: {
				default:
					'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 shadow-glow',
				destructive:
					'bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground hover:from-destructive/90 hover:to-destructive/70 shadow-lg',
				outline:
					'border border-input bg-background/50 backdrop-blur-md hover:bg-accent/50 hover:text-accent-foreground hover:border-accent shadow-sm',
				secondary:
					'bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground hover:from-secondary/90 hover:to-secondary/70 shadow-sm',
				ghost:
					'hover:bg-accent/50 hover:text-accent-foreground backdrop-blur-sm',
				link: 'text-primary underline-offset-4 hover:underline hover:text-primary/80',
				gradient:
					'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-glow',
				'gradient-secondary':
					'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600 shadow-glow',
				'gradient-success':
					'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-glow',
				'gradient-warning':
					'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-glow',
				glass:
					'bg-background/20 backdrop-blur-md border border-border/50 hover:bg-background/30 hover:border-border/70 shadow-luxury',
				premium:
					'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black hover:from-yellow-500 hover:via-yellow-600 hover:to-yellow-700 shadow-glow-lg font-semibold',
			},
			size: {
				default: 'h-11 px-6 py-2.5',
				sm: 'h-9 rounded-lg px-4 text-xs',
				lg: 'h-12 rounded-xl px-8 text-base',
				xl: 'h-14 rounded-2xl px-10 text-lg',
				icon: 'h-11 w-11',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button';
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
