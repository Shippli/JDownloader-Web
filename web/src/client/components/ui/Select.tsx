import type { Component } from 'solid-js';
import { Select as KobalteSelect } from '@kobalte/core';
import { cn } from '../../lib/cn';

export type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  class?: string;
  disabled?: boolean;
};

export const Select: Component<SelectProps> = (props) => {
  const selected = () => props.options.find(o => o.value === props.value) ?? null;

  return (
    <KobalteSelect.Root<SelectOption>
      value={selected()}
      onChange={opt => opt && props.onChange(opt.value)}
      options={props.options}
      optionValue="value"
      optionTextValue="label"
      disabled={props.disabled}
      itemComponent={itemProps => (
        <KobalteSelect.Item
          item={itemProps.item}
          class="relative flex items-center gap-2 px-3 py-2 text-sm text-foreground cursor-pointer select-none rounded-md hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:pointer-events-none outline-none"
        >
          <KobalteSelect.ItemLabel>{itemProps.item.rawValue.label}</KobalteSelect.ItemLabel>
          <KobalteSelect.ItemIndicator class="ml-auto">
            <span class="i-tabler-check w-4 h-4" />
          </KobalteSelect.ItemIndicator>
        </KobalteSelect.Item>
      )}
    >
      <KobalteSelect.Trigger
        class={cn(
          'inline-flex items-center justify-between w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed',
          props.class,
        )}
      >
        <KobalteSelect.Value<SelectOption>>
          {state => state.selectedOption().label}
        </KobalteSelect.Value>
        <KobalteSelect.Icon>
          <span class="i-tabler-chevron-down w-4 h-4 text-muted-foreground" />
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      <KobalteSelect.Portal>
        <KobalteSelect.Content class="z-50 min-w-32 rounded-lg border bg-card shadow-md animate-in fade-in-0 zoom-in-95">
          <KobalteSelect.Listbox class="p-1 max-h-60 overflow-y-auto" />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect.Root>
  );
};
