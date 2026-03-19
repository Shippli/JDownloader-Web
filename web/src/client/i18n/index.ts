import { createRoot, createSignal } from 'solid-js';
import de from './de';
import en from './en';

const PLACEHOLDER_RE = /\{(\d+)\}/g;

export type Language = 'en' | 'de';

export const languages: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
};

type Dict = Record<string, unknown>;

const dict: Record<Language, Dict> = { en, de };

function get(obj: Dict, keys: string[]): string | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Dict)[k];
  }
  return typeof cur === 'string' ? cur : undefined;
}

// createRoot gives the signal proper SolidJS ownership so reactive
// text nodes in all components (including Navbar) update when the language changes.
const { language: lang, setLanguage: setLang } = createRoot(() => {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('language') : null;
  const initial: Language = stored === 'en' || stored === 'de' ? stored : 'en';
  const [language, setLanguage] = createSignal<Language>(initial);
  return { language, setLanguage };
});

export const language = lang;

export function setLanguage(l: Language) {
  setLang(l);
  localStorage.setItem('language', l);
}

export function t(key: string): string {
  const keys = key.split('.');
  return get(dict[lang()], keys) ?? get(dict.en, keys) ?? key;
}

/** Like t() but replaces {0}, {1}, … with the provided arguments. */
export function tf(key: string, ...args: unknown[]): string {
  return t(key).replace(PLACEHOLDER_RE, (_, i) => String(args[Number(i)] ?? ''));
}
