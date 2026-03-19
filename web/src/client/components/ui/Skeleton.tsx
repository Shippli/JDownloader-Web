import type { Component, JSX } from 'solid-js';
import { createSignal, For, onCleanup, onMount, Show, splitProps } from 'solid-js';
import { cn } from '../../lib/cn';

const DELAY_MS = 100;

function useDelayed() {
  const [visible, setVisible] = createSignal(false);
  onMount(() => {
    const t = setTimeout(setVisible, DELAY_MS, true);
    onCleanup(() => clearTimeout(t));
  });
  return visible;
}

type SkeletonProps = JSX.HTMLAttributes<HTMLDivElement> & {
  class?: string;
};

export const Skeleton: Component<SkeletonProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <div
      class={cn('animate-pulse rounded bg-gray-200 dark:bg-gray-700', local.class)}
      {...rest}
    />
  );
};

// Row skeleton: icon + two text lines (used in Downloads/Grabber lists)
export const SkeletonRow: Component<{ class?: string }> = props => (
  <div class={cn('flex items-center gap-3 px-4 py-3', props.class)}>
    <Skeleton class="w-5 h-5 rounded shrink-0" />
    <div class="flex-1 flex flex-col gap-1.5">
      <Skeleton class="h-3.5 w-2/3" />
      <Skeleton class="h-3 w-1/3" />
    </div>
    <Skeleton class="h-3 w-16 shrink-0" />
  </div>
);

// List skeleton: multiple rows inside a card
export const SkeletonList: Component<{ rows?: number; class?: string }> = (props) => {
  const visible = useDelayed();
  return (
    <Show when={visible()}>
      <div class={cn('card overflow-hidden divide-y divide-border', props.class)}>
        <For each={Array.from({ length: props.rows ?? 5 })}>
          {() => <SkeletonRow />}
        </For>
      </div>
    </Show>
  );
};

// Table row skeleton (for config sections with key/value rows)
export const SkeletonTableRow: Component<{ class?: string }> = props => (
  <div class={cn('flex items-center justify-between px-4 py-3', props.class)}>
    <div class="flex flex-col gap-1.5">
      <Skeleton class="h-3.5 w-32" />
      <Skeleton class="h-3 w-20" />
    </div>
    <Skeleton class="h-7 w-16 rounded-lg" />
  </div>
);

export const SkeletonTable: Component<{ rows?: number; class?: string }> = (props) => {
  const visible = useDelayed();
  return (
    <Show when={visible()}>
      <div class={cn('card overflow-hidden divide-y divide-border', props.class)}>
        <For each={Array.from({ length: props.rows ?? 4 })}>
          {() => <SkeletonTableRow />}
        </For>
      </div>
    </Show>
  );
};
