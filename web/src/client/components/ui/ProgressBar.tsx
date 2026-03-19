import type { VariantProps } from 'class-variance-authority';
import type { Component } from 'solid-js';
import { Progress as KobalteProgress } from '@kobalte/core';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const fillVariants = cva('h-full rounded-full transition-all duration-300', {
  variants: {
    color: {
      blue: 'bg-primary',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
    },
  },
  defaultVariants: { color: 'blue' },
});

type ProgressBarProps = VariantProps<typeof fillVariants> & {
  value: number; // 0–100
  class?: string;
};

export const ProgressBar: Component<ProgressBarProps> = (props) => {
  const pct = () => Math.min(100, Math.max(0, props.value || 0));

  return (
    <KobalteProgress.Root
      value={pct()}
      minValue={0}
      maxValue={100}
      class={cn('h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden', props.class)}
    >
      <KobalteProgress.Track class="h-full w-full">
        <KobalteProgress.Fill
          class={fillVariants({ color: props.color })}
          style={{ width: `var(--kb-progress-fill-width)` }}
        />
      </KobalteProgress.Track>
    </KobalteProgress.Root>
  );
};
