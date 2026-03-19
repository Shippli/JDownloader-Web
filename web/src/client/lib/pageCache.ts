// In-memory cache that persists across SPA navigations within the same session.
// Cleared on full page reload (intentional — data may be stale after reload).

const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
}
