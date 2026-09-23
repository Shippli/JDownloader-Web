import type { ClassValue } from 'cva';
import { cx as concat } from 'cva';
import { defineConfig } from 'cva/config';
import { twMerge } from 'tailwind-merge';

export const { cva, cx } = defineConfig({
  cx: (...inputs: ClassValue[]) => twMerge(concat(...inputs)),
});
