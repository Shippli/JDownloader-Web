import type { Component } from 'solid-js';
import { DropdownMenu } from '@kobalte/core';
import { For, Show } from 'solid-js';
import { cn } from '../../lib/cn';

export type SortField = 'date' | 'name' | 'status';
export type SortDir = 'asc' | 'desc';
export type SortState = { field: SortField; dir: SortDir };

type Props = {
  value: SortState;
  onChange: (next: SortState) => void;
  labels: Record<SortField, string>;
};

const TRIGGER_ICONS: Record<SortField, Record<SortDir, string>> = {
  date: { asc: 'i-tabler-sort-ascending', desc: 'i-tabler-sort-descending' },
  name: { asc: 'i-tabler-sort-ascending-letters', desc: 'i-tabler-sort-descending-letters' },
  status: { asc: 'i-tabler-sort-ascending-small-big', desc: 'i-tabler-sort-descending-small-big' },
};

const FIELDS: SortField[] = ['date', 'name', 'status'];

export const SortDropdown: Component<Props> = (props) => {
  const triggerIcon = () => TRIGGER_ICONS[props.value.field][props.value.dir];

  const handleSelect = (field: SortField) => {
    if (field === props.value.field) {
      props.onChange({ field, dir: props.value.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      props.onChange({ field, dir: 'asc' });
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        class="inline-flex items-center justify-center rounded-md w-8 h-8 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
      >
        <span class={`${triggerIcon()} w-4 h-4`} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="z-50 min-w-32 overflow-hidden rounded-md border bg-card p-1 shadow-md">
          <For each={FIELDS}>
            {(field) => {
              const isActive = () => props.value.field === field;
              return (
                <DropdownMenu.Item
                  onSelect={() => handleSelect(field)}
                  class={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-md outline-none select-none',
                    'hover:bg-accent hover:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                    isActive() && 'text-primary font-medium',
                  )}
                >
                  <Show
                    when={isActive()}
                    fallback={<span class="w-4 h-4" />}
                  >
                    <span class={`${props.value.dir === 'asc' ? 'i-tabler-arrow-up' : 'i-tabler-arrow-down'} w-4 h-4`} />
                  </Show>
                  {props.labels[field]}
                </DropdownMenu.Item>
              );
            }}
          </For>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
