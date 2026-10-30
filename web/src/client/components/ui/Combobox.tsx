import type { Component } from 'solid-js';
import * as KobalteCombobox from '@kobalte/core/combobox';
import { createMemo, createSignal } from 'solid-js';
import { cx } from '../../lib/cva';
import { inputClass } from './Input';

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
  placeholder?: string;
  class?: string;
  disabled?: boolean;
  required?: boolean;
  maxOptions?: number;
};

export const Combobox: Component<ComboboxProps> = (props) => {
  const [query, setQuery] = createSignal('');

  // Filters outside Kobalte so the rendered list stays capped at maxOptions.
  const filtered = createMemo(() => {
    const q = query().toLowerCase().trim();
    const all = props.options;
    const matches = q
      ? all.filter(o => o.toLowerCase().includes(q))
      : all;
    return props.maxOptions
      ? matches.slice(0, props.maxOptions)
      : matches;
  });

  return (
    <KobalteCombobox.Root<string>
      class={cx('flex flex-col gap-1', props.class)}
      value={props.value || null}
      onChange={v => props.onChange(v ?? '')}
      onInputChange={setQuery}
      options={filtered()}
      defaultFilter={() => true}
      placeholder={props.placeholder}
      disabled={props.disabled}
      required={props.required}
      triggerMode="focus"
      itemComponent={itemProps => (
        <KobalteCombobox.Item
          item={itemProps.item}
          class="relative flex items-center gap-2 px-3 py-2 text-sm text-foreground cursor-pointer select-none rounded-md hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50 data-[disabled]:pointer-events-none outline-none"
        >
          <KobalteCombobox.ItemLabel>{itemProps.item.rawValue}</KobalteCombobox.ItemLabel>
          <KobalteCombobox.ItemIndicator class="ml-auto">
            <span class="i-tabler-check w-4 h-4" />
          </KobalteCombobox.ItemIndicator>
        </KobalteCombobox.Item>
      )}
    >
      {props.label && (
        <KobalteCombobox.Label class="text-sm font-medium text-foreground">
          {props.label}
        </KobalteCombobox.Label>
      )}
      <KobalteCombobox.HiddenSelect />
      <KobalteCombobox.Control class={cx(inputClass, 'flex items-center gap-2 p-0 pr-2 focus-within:ring-2 focus-within:ring-ring/50')}>
        <KobalteCombobox.Input class="flex-1 min-w-0 h-full px-3 py-2 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <KobalteCombobox.Trigger class="shrink-0 text-muted-foreground">
          <KobalteCombobox.Icon>
            <span class="i-tabler-selector w-4 h-4 block" />
          </KobalteCombobox.Icon>
        </KobalteCombobox.Trigger>
      </KobalteCombobox.Control>
      <KobalteCombobox.Portal>
        <KobalteCombobox.Content class="z-200 min-w-32 rounded-lg border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95">
          <KobalteCombobox.Listbox class="p-1 max-h-60 overflow-y-auto scrollbar-none" />
        </KobalteCombobox.Content>
      </KobalteCombobox.Portal>
    </KobalteCombobox.Root>
  );
};
