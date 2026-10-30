import type { Component } from 'solid-js';
import type { BadgeVariant } from './ui/Badge';
import { t } from '../i18n';
import { Badge } from './ui/Badge';

type StatusBadgeProps = {
  status: string;
  iconOnly?: boolean;
};

type StatusStyle = { icon: string; variant: BadgeVariant };

const STATUS_RULES: Array<{ test: (s: string) => boolean; style: StatusStyle }> = [
  {
    test: s => s.includes('extracting'),
    style: { icon: 'i-tabler-loader-2 animate-spin', variant: 'warning' },
  },
  {
    test: s => s.includes('ok') || s.includes('finished') || s.includes('complete'),
    style: { icon: 'i-tabler-check', variant: 'success' },
  },
  {
    test: s => s.includes('download') || s.includes('loading') || s.includes('running'),
    style: { icon: 'i-tabler-loader-2 animate-spin', variant: 'neutral' },
  },
  {
    test: s => s.includes('error') || s.includes('failed'),
    style: { icon: 'i-tabler-alert-circle', variant: 'danger' },
  },
  {
    test: s => s.startsWith('file already exists'),
    style: { icon: 'i-tabler-file-alert', variant: 'warning' },
  },
  {
    test: s => s.startsWith('try restarting'),
    style: { icon: 'i-tabler-refresh-alert', variant: 'warning' },
  },
  {
    test: s => s.includes('wait') || s.includes('queue'),
    style: { icon: 'i-tabler-clock', variant: 'warning' },
  },
  {
    test: s => s.includes('paused'),
    style: { icon: 'i-tabler-player-pause', variant: 'warning' },
  },
];

const DEFAULT_STYLE: StatusStyle = { icon: 'i-tabler-minus', variant: 'default' };

function getStatusStyle(status: string): StatusStyle {
  const s = status?.toLowerCase() ?? '';
  return STATUS_RULES.find(r => r.test(s))?.style ?? DEFAULT_STYLE;
}

const LABEL_RULES: Array<{ test: (s: string) => boolean; key: string }> = [
  {
    test: s => s.startsWith('extraction ok'),
    key: 'downloads.statusExtracted',
  },
  {
    test: s => s.startsWith('extracting'),
    key: 'downloads.statusExtracting',
  },
  {
    test: s => s.startsWith('extraction error'),
    key: 'downloads.statusExtractionError',
  },
  {
    test: s => s.startsWith('an error occurred'),
    key: 'downloads.statusError',
  },
  {
    test: s => s.startsWith('download'),
    key: 'downloads.statusDownloading',
  },
  {
    test: s => s.startsWith('finished'),
    key: 'downloads.statusFinished',
  },
  {
    test: s => s.startsWith('file already exists'),
    key: 'downloads.statusFileExists',
  },
  {
    test: s => s.startsWith('try restarting'),
    key: 'downloads.statusRetry',
  },
];

function normalizeLabel(status: string): string | null {
  const s = status?.toLowerCase() ?? '';
  const rule = LABEL_RULES.find(r => r.test(s));
  return rule
    ? t(rule.key)
    : null;
}

const StatusBadge: Component<StatusBadgeProps> = (props) => {
  const style = () => getStatusStyle(props.status ?? '');
  const label = () => {
    const normalized = normalizeLabel(props.status ?? '');
    if (normalized !== null) {
      return normalized;
    }
    const s = props.status ?? '–';
    return s.length > 40
      ? `${s.slice(0, 37)}…`
      : s;
  };

  return (
    <Badge shape="pill" variant={style().variant} icon={style().icon} iconOnly={props.iconOnly} title={props.status}>
      <span class="truncate max-w-40">{label()}</span>
    </Badge>
  );
};

export default StatusBadge;
