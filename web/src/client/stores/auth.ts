import type { User } from '../lib/api';
import { createSignal } from 'solid-js';
import { authApi } from '../lib/api';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);

async function loadSession() {
  try {
    const session = await authApi.getSession();
    setUser(session?.user ?? null);
  } catch {
    setUser(null);
  } finally {
    setLoading(false);
  }
}

async function signIn(email: string, password: string) {
  const result = await authApi.signIn(email, password);
  setUser(result.user);
  return result;
}

async function signUp(email: string, password: string, name: string) {
  const result = await authApi.signUp(email, password, name);
  setUser(result.user);
  return result;
}

async function signOut() {
  await authApi.signOut();
  setUser(null);
}

// Initialize session on load
loadSession();

export const authStore = {
  user,
  loading,
  signIn,
  signUp,
  signOut,
  loadSession,
};
