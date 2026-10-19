import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

type ScrollTextProps = JSX.HTMLAttributes<HTMLSpanElement>;

export function ScrollText(props: ScrollTextProps) {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <span
      {...rest}
      class={`block text-ellipsis overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-none [&::-webkit-scrollbar]:hidden ${local.class ?? ''}`}
    >
      {local.children}
    </span>
  );
}
