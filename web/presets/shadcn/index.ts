import type { Preset } from '@unocss/core';
import type { Theme } from '@unocss/preset-wind4';

import { preflights } from './preflights.ts';
import { rules } from './rules.ts';
import { theme } from './theme.ts';

export function presetShadcn(): Preset<Theme> {
  return {
    name: 'unocss-preset-shadcn',
    preflights,
    rules,
    theme,
  };
}
