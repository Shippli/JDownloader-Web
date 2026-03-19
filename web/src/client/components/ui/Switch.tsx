import type { Component, JSX } from 'solid-js';
import { Switch as KobalteSwitch } from '@kobalte/core';
import { Show } from 'solid-js';
import { cn } from '../../lib/cn';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: JSX.Element;
  title?: string;
  class?: string;
};

export const Switch: Component<SwitchProps> = props => (
  <KobalteSwitch.Root
    checked={props.checked}
    onChange={props.onChange}
    disabled={props.disabled}
    title={props.title}
    class={cn('inline-flex items-center gap-2 cursor-pointer select-none', props.class)}
  >
    <KobalteSwitch.Input />
    <KobalteSwitch.Control class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors bg-gray-300 dark:bg-background data-[checked]:bg-primary dark:data-[checked]:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none">
      <KobalteSwitch.Thumb class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform translate-x-1 data-[checked]:translate-x-6" />
    </KobalteSwitch.Control>
    <Show when={props.label}>
      <KobalteSwitch.Label class="text-sm text-foreground">{props.label}</KobalteSwitch.Label>
    </Show>
  </KobalteSwitch.Root>
);
