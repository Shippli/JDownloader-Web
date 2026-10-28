import { onCleanup } from 'solid-js';

// Calls onOutside for clicks outside el(). Registers on the current owner.
// Armed on the next tick so the click that opened the popup doesn't close it.
export function onClickOutside(el: () => Element | undefined, onOutside: () => void) {
  let armed = false;
  const timer = setTimeout(() => {
    armed = true;
  }, 0);
  const handler = (e: MouseEvent) => {
    if (armed && !el()?.contains(e.target as Node)) {
      onOutside();
    }
  };
  document.addEventListener('click', handler);
  onCleanup(() => {
    clearTimeout(timer);
    document.removeEventListener('click', handler);
  });
}
