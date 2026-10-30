import type { JSX } from 'solid-js';
import { createSignal, onCleanup, onMount, splitProps } from 'solid-js';

type ScrollTextProps = JSX.HTMLAttributes<HTMLSpanElement>;

export function ScrollText(props: ScrollTextProps) {
  const [local, rest] = splitProps(props, ['class', 'classList', 'children']);
  const [fadeLeft, setFadeLeft] = createSignal(false);
  const [fadeRight, setFadeRight] = createSignal(false);
  let el!: HTMLSpanElement;

  const update = () => {
    setFadeLeft(el.scrollLeft > 1);
    setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  onMount(() => {
    const resize = new ResizeObserver(update);
    resize.observe(el);
    const mutation = new MutationObserver(update);
    mutation.observe(el, { childList: true, characterData: true, subtree: true });
    update();
    onCleanup(() => {
      resize.disconnect();
      mutation.disconnect();
    });
  });

  return (
    <span
      {...rest}
      ref={el}
      onScroll={update}
      classList={{
        ...local.classList,
        'scroll-fade-left': fadeLeft(),
        'scroll-fade-right': fadeRight(),
      }}
      class={`scroll-fade block overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-none ${local.class ?? ''}`}
    >
      {local.children}
    </span>
  );
}
