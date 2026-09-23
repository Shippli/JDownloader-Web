import type { VariantProps } from 'cva';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cva, cx } from '../../lib/cva';

export const badgeVariants = cva({
  base: 'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground',
      success: 'bg-success/15 text-success',
      warning: 'bg-warning/15 text-warning',
      danger: 'bg-destructive/15 text-destructive',
      info: 'bg-info/15 text-info',
    },
  },
  defaultVariants: { variant: 'default' },
});

type BadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'class']);
  return (
    <span class={cx(badgeVariants({ variant: local.variant }), local.class)} {...rest} />
  );
};
