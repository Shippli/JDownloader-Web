import { createSignal } from 'solid-js';

const STORAGE_KEY = 'compact-view';

const stored = localStorage.getItem(STORAGE_KEY);
const [compactMode, setCompactSignal] = createSignal(stored === 'true');

export const compactViewStore = {
  enabled: compactMode,
  toggle() {
    const next = !compactMode();
    setCompactSignal(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  },
  set(value: boolean) {
    setCompactSignal(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  },
};
