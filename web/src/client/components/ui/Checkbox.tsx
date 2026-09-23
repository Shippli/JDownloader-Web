import type { Component, JSX } from 'solid-js';
import * as KobalteCheckbox from '@kobalte/core/checkbox';
import { cx } from '../../lib/cva';

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: JSX.Element;
  class?: string;
  size?: 'sm' | 'md';
};

export const Checkbox: Component<CheckboxProps> = props => (
  <KobalteCheckbox.Root
    checked={props.checked}
    onChange={props.onChange}
    disabled={props.disabled}
    class={cx('inline-flex items-center gap-2 cursor-pointer select-none', props.class)}
  >
    <KobalteCheckbox.Input class="peer sr-only" />
    <KobalteCheckbox.Control class={cx('rounded border-2 border-input dark:bg-input/30 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 data-[checked]:bg-primary data-[checked]:border-primary data-[checked]:text-primary-foreground data-[disabled]:opacity-50', props.size === 'md' ? 'w-5 h-5' : 'w-4 h-4')}>
      <span class={cx('i-tabler-check', props.size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3', !props.checked && 'opacity-0')} />
    </KobalteCheckbox.Control>
    <KobalteCheckbox.Label class="text-sm text-foreground">{props.label}</KobalteCheckbox.Label>
  </KobalteCheckbox.Root>
);
