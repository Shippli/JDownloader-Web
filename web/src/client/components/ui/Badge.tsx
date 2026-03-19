import type { VariantProps } from 'class-variance-authority';
import type { Component, JSX } from 'solid-js';
import { cva } from 'class-variance-authority';
import { splitProps } from 'solid-js';
import { cn } from '../../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 dark:bg-gray-800 text-muted-foreground',
        success: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
        warning: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
        danger: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
        info: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type BadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'class']);
  return (
    <span class={cn(badgeVariants({ variant: local.variant }), local.class)} {...rest} />
  );
};
