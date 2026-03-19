import { createSignal } from 'solid-js';

const STORAGE_KEY = 'api-debug-mode';

const stored = localStorage.getItem(STORAGE_KEY);
const [debugMode, setDebugSignal] = createSignal(stored === 'true');

export const debugStore = {
  enabled: debugMode,
  toggle() {
    const next = !debugMode();
    setDebugSignal(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  },
  set(value: boolean) {
    setDebugSignal(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  },
};
