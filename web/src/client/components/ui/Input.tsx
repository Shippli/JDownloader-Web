import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '../../lib/cn';

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export const InlineInput: Component<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <input
      class={cn('w-full text-sm font-semibold bg-transparent border-b border-primary outline-none text-foreground', local.class)}
      {...rest}
    />
  );
};

export const Input: Component<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <input
      class={cn(
        'w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed',
        local.class,
      )}
      {...rest}
    />
  );
};
