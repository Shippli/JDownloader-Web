import process from 'node:process';
import { presetIcons } from '@unocss/preset-icons';
import { presetUno } from '@unocss/preset-uno';
import UnoCSS from '@unocss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import pkg from './package.json' with { type: 'json' };

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
    }),
    solid(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version),
  },
  root: '.',
  build: {
    outDir: 'dist/public',
    rolldownOptions: {
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
