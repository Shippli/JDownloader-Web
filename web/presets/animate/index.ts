import type { Preset } from '@unocss/core';
import type { Theme } from '@unocss/preset-wind4';

import { rules } from './rules.ts';
import { theme } from './theme.ts';

export function presetAnimate(): Preset<Theme> {
  return {
    name: 'unocss-preset-animate',
    rules,
    theme,
  };
}
