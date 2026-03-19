import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '../../lib/cn';

type DivProps = JSX.HTMLAttributes<HTMLDivElement> & { selected?: boolean };

export const Card: Component<DivProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'selected']);
  return <div class={cn('bg-card rounded-xl border shadow-sm', local.selected && 'ring-2 ring-primary', local.class)} {...rest} />;
};

export const CardHeader: Component<DivProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cn('px-6 py-4 border-b', local.class)} {...rest} />;
};

export const CardContent: Component<DivProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cn('p-6', local.class)} {...rest} />;
};

export const CardTitle: Component<JSX.HTMLAttributes<HTMLHeadingElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return <h3 class={cn('text-base font-semibold text-foreground', local.class)} {...rest} />;
};

export const CardDescription: Component<JSX.HTMLAttributes<HTMLParagraphElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return <p class={cn('text-sm text-muted-foreground', local.class)} {...rest} />;
};
