import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { t } from '../i18n';
import { priorityInfo } from '../lib/priority';
import { Badge } from './ui/Badge';

const PriorityBadge: Component<{ priority?: string; iconOnly?: boolean }> = (props) => {
  const info = () => priorityInfo(props.priority);
  return (
    <Show when={info()?.variant ? info() : undefined}>
      {p => (
        <Badge shape="pill" variant={p().variant} icon={p().icon} iconOnly={props.iconOnly} title={props.iconOnly ? t(p().labelKey) : undefined}>
          {t(p().labelKey)}
        </Badge>
      )}
    </Show>
  );
};

export default PriorityBadge;
