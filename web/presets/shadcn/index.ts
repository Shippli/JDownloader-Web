import type { Preset } from '@unocss/core';
import type { Theme } from '@unocss/preset-wind4';

import { preflights } from './preflights';
import { rules } from './rules';
import { theme } from './theme';

export function presetShadcn(): Preset<Theme> {
  return {
    name: 'unocss-preset-shadcn',
    preflights,
    rules,
    theme,
  };
}
