import { createPersistedToggle } from '../lib/persisted';

export const debugStore = createPersistedToggle('api-debug-mode');
