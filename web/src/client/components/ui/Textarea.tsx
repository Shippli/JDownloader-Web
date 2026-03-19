import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '../../lib/cn';

type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea: Component<TextareaProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <textarea
      class={cn(
        'w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-y disabled:opacity-50 disabled:cursor-not-allowed',
        local.class,
      )}
      {...rest}
    />
  );
};
