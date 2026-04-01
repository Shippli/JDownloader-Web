import type { Component, JSX } from 'solid-js';
import { Checkbox as KobalteCheckbox } from '@kobalte/core';
import { cn } from '../../lib/cn';

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
    class={cn('inline-flex items-center gap-2 cursor-pointer select-none', props.class)}
  >
    <KobalteCheckbox.Input class="sr-only" />
    <KobalteCheckbox.Control class={cn('rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors data-[checked]:bg-primary data-[checked]:border-primary dark:data-[checked]:border-white disabled:opacity-50', props.size === 'md' ? 'w-5 h-5' : 'w-4 h-4')}>
      <span class={cn('i-tabler-check text-white dark:text-black', props.size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3', !props.checked && 'opacity-0')} />
    </KobalteCheckbox.Control>
    <KobalteCheckbox.Label class="text-sm text-foreground">{props.label}</KobalteCheckbox.Label>
  </KobalteCheckbox.Root>
);
