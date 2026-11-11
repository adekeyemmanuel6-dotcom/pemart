import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-btn px-6 text-base font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper hover:bg-ink/85',
        secondary: 'border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
        ghost: 'text-ink hover:bg-sand',
        ember: 'bg-ember text-ink hover:bg-ember/90',
      },
      size: { default: 'min-h-12 px-6', sm: 'min-h-11 px-4 text-sm', icon: 'size-12 px-0' },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';
