import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { t } from '../i18n';

type StatusBadgeProps = {
  status: string;
  finished?: boolean;
  iconOnly?: boolean;
};

type StatusStyle = { icon: string; color: string; bg: string };

const STATUS_RULES: Array<{ test: (s: string, finished?: boolean) => boolean; style: StatusStyle }> = [
  { test: s => s.includes('extracting'), style: { icon: 'i-tabler-loader-2 animate-spin', color: 'text-warning', bg: 'bg-warning/10' } },
  { test: s => s.includes('ok') || s.includes('finished') || s.includes('complete'), style: { icon: 'i-tabler-check', color: 'text-success', bg: 'bg-success/10' } },
  { test: s => s.includes('download') || s.includes('loading') || s.includes('running'), style: { icon: 'i-tabler-loader-2 animate-spin', color: 'text-foreground', bg: 'bg-muted' } },
  { test: s => s.includes('error') || s.includes('failed'), style: { icon: 'i-tabler-alert-circle', color: 'text-destructive', bg: 'bg-destructive/10' } },
  { test: s => s.startsWith('file already exists'), style: { icon: 'i-tabler-file-alert', color: 'text-warning', bg: 'bg-warning/10' } },
  { test: s => s.startsWith('try restarting'), style: { icon: 'i-tabler-refresh-alert', color: 'text-warning', bg: 'bg-warning/10' } },
  { test: s => s.includes('wait') || s.includes('queue'), style: { icon: 'i-tabler-clock', color: 'text-warning', bg: 'bg-warning/10' } },
  { test: s => s.includes('paused'), style: { icon: 'i-tabler-player-pause', color: 'text-warning', bg: 'bg-warning/10' } },
];

const DEFAULT_STYLE: StatusStyle = { icon: 'i-tabler-minus', color: 'text-muted-foreground', bg: 'bg-muted' };

function getStatusStyle(status: string, finished?: boolean): StatusStyle {
  const s = status?.toLowerCase() ?? '';
  return STATUS_RULES.find(r => r.test(s, finished))?.style ?? DEFAULT_STYLE;
}

const LABEL_RULES: Array<{ test: (s: string) => boolean; key: string }> = [
  { test: s => s.startsWith('extraction ok'), key: 'downloads.statusExtracted' },
  { test: s => s.startsWith('extracting'), key: 'downloads.statusExtracting' },
  { test: s => s.startsWith('extraction error'), key: 'downloads.statusExtractionError' },
  { test: s => s.startsWith('an error occurred'), key: 'downloads.statusError' },
  { test: s => s.startsWith('download'), key: 'downloads.statusDownloading' },
  { test: s => s.startsWith('finished'), key: 'downloads.statusFinished' },
  { test: s => s.startsWith('file already exists'), key: 'downloads.statusFileExists' },
  { test: s => s.startsWith('try restarting'), key: 'downloads.statusRetry' },
];

function normalizeLabel(status: string): string | null {
  const s = status?.toLowerCase() ?? '';
  const rule = LABEL_RULES.find(r => r.test(s));
  return rule ? t(rule.key) : null;
}

const StatusBadge: Component<StatusBadgeProps> = (props) => {
  const style = () => getStatusStyle(props.status ?? '', props.finished);
  const label = () => {
    const normalized = normalizeLabel(props.status ?? '');
    if (normalized !== null) {
      return normalized;
    }
    const s = props.status ?? '–';
    return s.length > 40 ? `${s.slice(0, 37)}…` : s;
  };

  return (
    <span
      class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style().color} ${style().bg}`}
      title={props.status}
    >
      <span class={`${style().icon} w-3 h-3 flex-shrink-0`} />
      <Show when={!props.iconOnly}>
        <span class="truncate max-w-40">{label()}</span>
      </Show>
    </span>
  );
};

export default StatusBadge;
