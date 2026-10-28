import type { Component } from 'solid-js';
import { cx } from '../../lib/cva';

export const EmptyState: Component<{ icon: string; text: string; class?: string }> = props => (
  <div class={cx('flex flex-col items-center justify-center text-muted-foreground', props.class ?? 'py-20')}>
    <span class={`${props.icon} w-12 h-12 mb-3`} />
    <p class="text-sm">{props.text}</p>
  </div>
);
