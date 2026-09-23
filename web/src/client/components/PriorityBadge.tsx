import type { Component } from 'solid-js';
import { Show } from 'solid-js';

type PriorityBadgeProps = {
  priority?: string;
  iconOnly?: boolean;
};

function getPriorityStyle(priority: string) {
  switch (priority) {
    case 'HIGHEST':
      return { icon: 'i-tabler-arrow-bar-up', color: 'text-destructive', bg: 'bg-destructive/10', label: 'Highest' };
    case 'HIGHER':
      return { icon: 'i-tabler-arrows-up', color: 'text-warning', bg: 'bg-warning/10', label: 'Higher' };
    case 'HIGH':
      return { icon: 'i-tabler-arrow-up', color: 'text-warning', bg: 'bg-warning/10', label: 'High' };
    case 'LOW':
    case 'LOWER':
      return { icon: 'i-tabler-arrow-down', color: 'text-muted-foreground', bg: 'bg-muted', label: 'Low' };
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
