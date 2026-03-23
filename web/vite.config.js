import { createRequire } from 'node:module';
import { presetIcons } from '@unocss/preset-icons';
import { presetUno } from '@unocss/preset-uno';
import UnoCSS from '@unocss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export default defineConfig({
  plugins: [
    UnoCSS({
      // Inline config to avoid jiti/unconfig stack overflow issue with Bun
      presets: [
        presetUno({ dark: 'class' }),
        presetIcons({
          scale: 1.2,
          warn: true,
          collections: {
            tabler: () => import('@iconify-json/tabler/icons.json').then(i => i.default),
          },
        }),
      ],
      shortcuts: {
        // Background
        'bg-accent': 'bg-[hsl(var(--accent))]',
        'bg-background': 'bg-[hsl(var(--background))]',
        'bg-card': 'bg-[hsl(var(--card))]',
        'bg-destructive': 'bg-[hsl(var(--destructive))]',
        'bg-muted': 'bg-[hsl(var(--muted))]',
        'bg-primary': 'bg-[hsl(var(--primary))]',
        'bg-secondary': 'bg-[hsl(var(--secondary))]',
        // Text
        'text-accent-foreground': 'text-[hsl(var(--accent-foreground))]',
        'text-destructive-foreground': 'text-[hsl(var(--destructive-foreground))]',
        'text-foreground': 'text-[hsl(var(--foreground))]',
        'text-muted-foreground': 'text-[hsl(var(--muted-foreground))]',
        'text-primary-foreground': 'text-[hsl(var(--primary-foreground))]',
        'text-secondary-foreground': 'text-[hsl(var(--secondary-foreground))]',
        // Border & ring
        'border-input': 'border-[hsl(var(--input))]',
        'border-primary': 'border-[hsl(var(--primary))]',
        'ring-primary': 'ring-[hsl(var(--primary))]',
        // Components
        'card': 'bg-card rounded-xl border shadow-sm',
      },
      safelist: [
        // Background colors (dynamic badge/status usage)
        'bg-blue-100',
        'bg-gray-100',
        'bg-gray-200',
        'bg-green-100',
        'bg-red-100',
        'bg-yellow-100',
        // Text colors (dynamic badge/status usage)
        'text-blue-500',
        'text-gray-400',
        'text-green-500',
        'text-red-500',
        'text-yellow-500',
        // Dark mode
        'dark:bg-gray-700',
        'dark:bg-green-900/20',
        'dark:bg-red-900/20',
        'dark:bg-yellow-900/20',
        'dark:data-[checked]:border-white',
        'dark:text-black',
        // Semantic theme shortcuts
        'bg-accent',
        'bg-background',
        'bg-card',
        'bg-destructive',
        'bg-muted',
        'bg-primary',
        'bg-secondary',
        'border-input',
        'border-primary',
        'text-accent-foreground',
        'text-destructive-foreground',
        'text-foreground',
        'text-muted-foreground',
        'text-primary-foreground',
        'text-secondary-foreground',
        // Icons
        'i-tabler-download',
        'i-tabler-link',
      ],
    }),
    solid(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  root: '.',
  build: {
    outDir: 'dist/public',
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
