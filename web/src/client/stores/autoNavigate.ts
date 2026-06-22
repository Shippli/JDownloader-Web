import { createSignal } from 'solid-js';

const STORAGE_KEY = 'auto-navigate';

const stored = localStorage.getItem(STORAGE_KEY);
const [autoNavigateMode, setAutoNavigateSignal] = createSignal(stored === 'true');

export const autoNavigateStore = {
  enabled: autoNavigateMode,
  toggle() {
    const next = !autoNavigateMode();
    setAutoNavigateSignal(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  },
  set(value: boolean) {
    setAutoNavigateSignal(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  },
};
