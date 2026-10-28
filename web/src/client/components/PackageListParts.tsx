import type { Component } from 'solid-js';
import type { SortState } from './ui/SortDropdown';
import { Show } from 'solid-js';
import { t } from '../i18n';
import { jdStore } from '../stores/jd';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { SortDropdown } from './ui/SortDropdown';

// Building blocks shared by the Downloads and Grabber pages.

export const ExpandButton: Component<{ expanded: boolean; onToggle: () => void; class?: string }> = props => (
  <Button
    variant="ghost"
    size="icon"
    class={props.class ?? 'shrink-0'}
    onClick={(e) => {
      e.stopPropagation();
      props.onToggle();
    }}
  >
    <span class={`i-tabler-chevron-down w-4 h-4 transition-transform ${props.expanded ? 'rotate-180' : ''}`} />
  </Button>
);

// JD-unavailable banner, or the last action error while JD is reachable.
export const ListAlerts: Component<{ unavailableText: string; error: string }> = props => (
  <>
    <Show when={jdStore.connected() === false}>
      <Alert icon="i-tabler-plug-off" class="p-4 rounded-xl mb-4">{props.unavailableText}</Alert>
    </Show>
    <Show when={props.error && jdStore.connected() !== false}>
      <Alert class="p-4 rounded-xl mb-4">{props.error}</Alert>
    </Show>
  </>
);

export const ListSortDropdown: Component<{ value: SortState; onChange: (s: SortState) => void }> = props => (
  <SortDropdown
    value={props.value}
    onChange={props.onChange}
    labels={{ date: t('common.sortByDate'), name: t('common.sortByName'), status: t('common.sortByStatus') }}
  />
);

// Toolbar tail: "clear selection" while selecting, else "select all"; plus sort.
export const SelectionControls: Component<{
  hasSelection: boolean;
  hasItems: boolean;
  onClear: () => void;
  onSelectAll: () => void;
  sort: SortState;
  onSortChange: (s: SortState) => void;
}> = props => (
  <>
    <Show when={props.hasSelection}>
      <Button variant="ghost" size="icon" onClick={() => props.onClear()} icon="i-tabler-x" />
    </Show>
    <Show when={props.hasItems}>
      <Show when={!props.hasSelection}>
        <Button variant="ghost" onClick={() => props.onSelectAll()} class="text-sm">{t('common.selectAll')}</Button>
      </Show>
      <ListSortDropdown value={props.sort} onChange={props.onSortChange} />
    </Show>
  </>
);
