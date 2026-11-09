export const LONG_PRESS_MS = 500;

// Touch devices open context menus via long-press instead of `contextmenu`.
export const isTouchDevice = () => navigator.maxTouchPoints > 0;

// Long-press touch handlers; one instance can serve many rows via `handlers(arg)`.
// `handlers.cancel()` clears a pending timer (call on cleanup).
export function createLongPress<T>(onLongPress: (arg: T) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let moved = false;
  let triggered = false;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const handlers = (arg: T) => ({
    onTouchStart: (e: TouchEvent) => {
      e.stopPropagation();
      moved = false;
      triggered = false;
      cancel();
      timer = setTimeout(() => {
        timer = null;
        if (!moved) {
          triggered = true;
          navigator.vibrate?.(50);
          onLongPress(arg);
        }
      }, LONG_PRESS_MS);
    },
    onTouchMove: () => {
      moved = true;
      cancel();
    },
    onTouchEnd: (e: TouchEvent) => {
      cancel();
      if (triggered) {
        e.preventDefault();
        triggered = false;
      }
    },
  });
  return Object.assign(handlers, { cancel });
}
