import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';
import { inputClass } from './Input';

type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea: Component<TextareaProps> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <textarea
      class={cx(inputClass, 'resize-y', local.class)}
      {...rest}
    />
  );
};
