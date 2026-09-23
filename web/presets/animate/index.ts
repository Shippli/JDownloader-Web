import type { Preset } from '@unocss/core';
import type { Theme } from '@unocss/preset-wind4';

import { rules } from './rules';
import { theme } from './theme';

export function presetAnimate(): Preset<Theme> {
  return {
    name: 'unocss-preset-animate',
    rules,
    theme,
  };
}
