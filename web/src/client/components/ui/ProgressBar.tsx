import type { VariantProps } from 'cva';
import type { Component } from 'solid-js';
import * as KobalteProgress from '@kobalte/core/progress';
import { cva, cx } from '../../lib/cva';

const fillVariants = cva({
  base: 'h-full w-full rounded-full transition-transform duration-300 origin-left scale-x-(--progress)',
  variants: {
    color: {
      blue: 'bg-primary',
      green: 'bg-success',
      yellow: 'bg-warning',
      red: 'bg-destructive',
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
      class={cx('h-1.5 w-full bg-muted rounded-full overflow-hidden', props.class)}
    >
      <KobalteProgress.Track class="h-full w-full">
        <KobalteProgress.Fill
          class={fillVariants({ color: props.color })}
          style={{ '--progress': pct() / 100 }}
        />
      </KobalteProgress.Track>
    </KobalteProgress.Root>
  );
};
