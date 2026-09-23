import type { Rule } from '@unocss/core';
import type { Theme } from '@unocss/preset-wind4';

export const rules: Rule<Theme>[] = [
  ['scrollbar-none', { 'scrollbar-width': 'none' }],
  ['pixelated', { 'image-rendering': 'pixelated' }],
];
