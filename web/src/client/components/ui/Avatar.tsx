import type { VariantProps } from 'cva';
import type { Component, JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';
import { cva, cx } from '../../lib/cva';

const avatarVariants = cva({
  base: 'inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold select-none shrink-0 overflow-hidden',
  variants: {
    size: {
      xs: 'w-5 h-5 text-2xs',
      sm: 'w-7 h-7 text-xs',
      md: 'w-9 h-9 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type AvatarProps = JSX.HTMLAttributes<HTMLSpanElement>
  & VariantProps<typeof avatarVariants> & {
    src?: string;
    alt?: string;
    name?: string;
  };

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 1)
    .map(w => w[0].toUpperCase())
    .join('');
}

export const Avatar: Component<AvatarProps> = (props) => {
  const [local, rest] = splitProps(props, ['src', 'alt', 'name', 'size', 'class']);

  return (
    <span class={cx(avatarVariants({ size: local.size }), local.class)} {...rest}>
      <Show
        when={local.src}
        fallback={(
          <span aria-hidden="true">
            {local.name ? getInitials(local.name) : '?'}
          </span>
        )}
      >
        <img
          src={local.src}
          alt={local.alt ?? local.name ?? ''}
          class="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </Show>
    </span>
  );
};
