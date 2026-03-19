import { createSignal } from 'solid-js';

// null = not yet known, true = connected, false = unreachable
const [connected, setConnected] = createSignal<boolean | null>(null);

export function setJdConnected(v: boolean | null) {
  setConnected(v);
}

export const jdStore = { connected };
