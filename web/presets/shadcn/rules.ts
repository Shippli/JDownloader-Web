import type { Rule } from '@unocss/core';
import type { Theme } from '@unocss/preset-wind4';

export const rules: Rule<Theme>[] = [
  [
    'scrollbar-none',
    { 'scrollbar-width': 'none' },
  ],
  [
    'pixelated',
    { 'image-rendering': 'pixelated' },
  ],
  [
    'scroll-fade',
    {
      'mask-image': 'linear-gradient(to right, transparent, black var(--fade-left), black calc(100% - var(--fade-right)), transparent)',
      'transition': '--fade-left 150ms ease, --fade-right 150ms ease',
    },
  ],
  [
    'scroll-fade-left',
    { '--fade-left': '2rem' },
  ],
  [
    'scroll-fade-right',
    { '--fade-right': '2rem' },
  ],
];
