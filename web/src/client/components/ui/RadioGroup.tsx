import type { Component } from 'solid-js';
import { RadioGroup as KobalteRadioGroup } from '@kobalte/core';
import { For } from 'solid-js';
import { cn } from '../../lib/cn';

type RadioOption = {
  value: string;
  label: string;
};

type RadioGroupProps = {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  class?: string;
};

export const RadioGroup: Component<RadioGroupProps> = props => (
  <KobalteRadioGroup.Root
    value={props.value}
    onChange={props.onChange}
    class={cn('flex flex-col gap-2', props.class)}
  >
    <For each={props.options}>
      {option => (
        <KobalteRadioGroup.Item value={option.value} class="flex items-center gap-2.5 cursor-pointer select-none">
          <KobalteRadioGroup.ItemInput class="sr-only" />
          <KobalteRadioGroup.ItemControl class="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center transition-colors data-[checked]:border-primary">
            <KobalteRadioGroup.ItemIndicator class="w-2 h-2 rounded-full bg-primary" />
          </KobalteRadioGroup.ItemControl>
          <KobalteRadioGroup.ItemLabel class="text-sm text-foreground">{option.label}</KobalteRadioGroup.ItemLabel>
        </KobalteRadioGroup.Item>
      )}
    </For>
  </KobalteRadioGroup.Root>
);
