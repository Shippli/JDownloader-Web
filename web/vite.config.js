import process from 'node:process';
import { presetIcons } from '@unocss/preset-icons';
import { presetWind4 } from '@unocss/preset-wind4';
import transformerDirectives from '@unocss/transformer-directives';
import transformerVariantGroup from '@unocss/transformer-variant-group';
import UnoCSS from '@unocss/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import pkg from './package.json' with { type: 'json' };
import { presetAnimate } from './presets/animate';
import { presetShadcn } from './presets/shadcn';

export default defineConfig({
  plugins: [
    UnoCSS({
      // Inline config to avoid jiti/unconfig stack overflow issue with Bun
      presets: [
        presetWind4({
          dark: {
            dark: '[data-kb-theme="dark"]',
            light: '[data-kb-theme="light"]',
          },
        }),
        presetAnimate(),
        presetShadcn(),
        presetIcons({
          scale: 1.2,
          warn: true,
          collections: {
            tabler: () => import('@iconify-json/tabler/icons.json').then(i => i.default),
          },
        }),
      ],
      transformers: [transformerVariantGroup(), transformerDirectives()],
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
