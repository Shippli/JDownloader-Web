import type { VariantProps } from 'cva';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cva, cx } from '../../lib/cva';

export const buttonVariants = cva({
  base: 'inline-flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-colors cursor-pointer select-none focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:opacity-90',
      secondary: 'bg-secondary text-secondary-foreground hover:opacity-80',
      danger: 'bg-destructive text-white hover:bg-destructive/90',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    },
    size: {
      default: 'px-4 py-2',
      sm: 'px-3 py-1.5 text-xs',
      lg: 'px-6 py-3',
      icon: 'p-1.5',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'size', 'class']);
  return (
    <button
      class={cx(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  );
};
