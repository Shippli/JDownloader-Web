import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

type DivProps = JSX.HTMLAttributes<HTMLDivElement> & { selected?: boolean };

export const Card: Component<DivProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'selected']);
  return <div class={cx('bg-card text-card-foreground rounded-xl border shadow-xs', local.selected && 'ring-2 ring-primary', local.class)} {...rest} />;
};

export const CardContent: Component<DivProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cx('p-6', local.class)} {...rest} />;
};
