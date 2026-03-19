import { createSignal } from 'solid-js';
import { configApi } from '../lib/api';

const [configured, setConfigured] = createSignal<boolean | null>(null); // null = not yet checked

export const connectionStore = {
  configured,
  setConfigured,
  async check() {
    try {
      const data = await configApi.getConnection();
      setConfigured(data.configured);
    } catch {
      setConfigured(false);
    }
  },
};
