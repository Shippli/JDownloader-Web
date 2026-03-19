import { createEffect, createSignal } from 'solid-js';

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) ?? 'system';
}

const [theme, setTheme] = createSignal<Theme>(getInitialTheme());

function getEffectiveTheme(): 'light' | 'dark' {
  const t = theme();
  if (t === 'system') {
    return getSystemTheme();
  }
  return t;
}

const [effectiveTheme, setEffectiveTheme] = createSignal<'light' | 'dark'>(getEffectiveTheme());

createEffect(() => {
  const t = theme();
  localStorage.setItem('theme', t);
  const effective = t === 'system' ? getSystemTheme() : t;
  setEffectiveTheme(effective);
  if (effective === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme() === 'system') {
      const effective = getSystemTheme();
      setEffectiveTheme(effective);
      if (effective === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
}

function toggleTheme() {
  setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
}

function setThemeMode(t: Theme) {
  setTheme(t);
}

export const themeStore = {
  theme,
  effectiveTheme,
  toggleTheme,
  setTheme: setThemeMode,
};
