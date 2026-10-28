import type { Component, JSX } from 'solid-js';
import { cx } from '../../lib/cva';

type AlertProps = {
  variant?: 'error' | 'success';
  icon?: string;
  class?: string;
  children: JSX.Element;
};

export const Alert: Component<AlertProps> = (props) => {
  const success = () => props.variant === 'success';
  return (
    <div class={cx('flex items-center gap-2 p-3 rounded-lg text-sm', success() ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive', props.class)}>
      <span class={cx(props.icon ?? (success() ? 'i-tabler-circle-check' : 'i-tabler-alert-circle'), 'w-4 h-4 flex-shrink-0')} />
      {props.children}
    </div>
  );
};
