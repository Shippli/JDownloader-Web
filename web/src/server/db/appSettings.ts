import { sqlite } from './index';

export function getAppSetting(key: string): string | null {
  return (sqlite.query('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | null)?.value ?? null;
}

export function setAppSetting(key: string, value: string) {
  sqlite.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
}
