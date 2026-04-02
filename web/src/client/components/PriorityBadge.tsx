import type { Component } from 'solid-js';
import { Show } from 'solid-js';

type PriorityBadgeProps = {
  priority?: string;
  iconOnly?: boolean;
};

function getPriorityStyle(priority: string) {
  switch (priority) {
    case 'HIGHEST':
      return { icon: 'i-tabler-arrow-bar-up', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Highest' };
    case 'HIGHER':
      return { icon: 'i-tabler-arrows-up', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', label: 'Higher' };
    case 'HIGH':
      return { icon: 'i-tabler-arrow-up', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'High' };
    case 'LOW':
    case 'LOWER':
      return { icon: 'i-tabler-arrow-down', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', label: 'Low' };
    default:
      return null;
  }
}

const PriorityBadge: Component<PriorityBadgeProps> = (props) => {
  const style = () => props.priority ? getPriorityStyle(props.priority) : null;

  return (
    <Show when={style()}>
      {s => (
        <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s().color} ${s().bg}`} title={props.iconOnly ? s().label : undefined}>
          <span class={`${s().icon} w-3 h-3 flex-shrink-0`} />
          <Show when={!props.iconOnly}>{s().label}</Show>
        </span>
      )}
    </Show>
  );
};

export default PriorityBadge;
