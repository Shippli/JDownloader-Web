import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea: Component<TextareaProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <textarea
      class={cx(
        'w-full px-3 py-2 rounded-lg border border-input bg-transparent dark:bg-input/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm resize-y disabled:opacity-50 disabled:cursor-not-allowed',
        local.class,
      )}
      {...rest}
    />
  );
};
