import { createSignal } from 'solid-js';

export function createPersistedSignal<T>(key: string, fallback: T) {
  let initial = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) {
      initial = JSON.parse(raw) as T;
    }
  } catch {}
  const [value, setValue] = createSignal<T>(initial);
  const set = (next: T) => {
    setValue(() => next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  return [value, set] as const;
}

export function createPersistedToggle(key: string) {
  const [enabled, set] = createPersistedSignal(key, false);
  return { enabled, toggle: () => set(!enabled()) };
}
