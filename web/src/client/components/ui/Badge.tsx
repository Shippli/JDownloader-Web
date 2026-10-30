import type { VariantProps } from 'cva';
import type { Component, JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import { cva, cx } from '../../lib/cva';

const badgeVariants = cva({
  base: 'inline-flex items-center text-xs font-medium',
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground',
      neutral: 'bg-muted text-foreground',
      success: 'bg-success/15 text-success',
      warning: 'bg-warning/15 text-warning',
      danger: 'bg-destructive/15 text-destructive',
      info: 'bg-info/15 text-info',
    },
    shape: {
      default: 'rounded px-1.5 py-0.5',
      pill: 'rounded-full gap-1.5 px-2 py-0.5',
    },
  },
  defaultVariants: { variant: 'default', shape: 'default' },
});

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

type BadgeProps = JSX.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & {
  // Icon class rendered before children.
  icon?: string;
  // Hides children, keeps the icon.
  iconOnly?: boolean;
};

export const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'variant',
    'shape',
    'class',
    'icon',
    'iconOnly',
    'children',
  ]);
  return (
    <span class={cx(badgeVariants({ variant: local.variant, shape: local.shape }), local.class)} {...rest}>
      <Show when={local.icon}>
        <span class={cx(local.icon, 'w-3 h-3 flex-shrink-0')} />
      </Show>
      <Show when={!local.iconOnly}>{local.children}</Show>
    </span>
  );
};
