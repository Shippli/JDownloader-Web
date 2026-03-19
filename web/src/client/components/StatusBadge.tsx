import type { Component } from 'solid-js';

type StatusBadgeProps = {
  status: string;
  finished?: boolean;
};

function getStatusStyle(status: string, finished?: boolean) {
  const s = status?.toLowerCase() ?? '';

  if (s.includes('extracting') || s.includes('unpack')) {
    return { icon: 'i-tabler-loader-2 animate-spin', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
  }
  if (finished || s.includes('finished') || s.includes('complete')) {
    return { icon: 'i-tabler-check', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
  }
  if (s.includes('download') || s.includes('loading') || s.includes('running')) {
    return { icon: 'i-tabler-loader-2 animate-spin', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
  }
  if (s.includes('error') || s.includes('failed')) {
    return { icon: 'i-tabler-alert-circle', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
  }
  if (s.includes('wait') || s.includes('queue')) {
    return { icon: 'i-tabler-clock', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
  }
  if (s.includes('paused')) {
    return { icon: 'i-tabler-player-pause', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' };
  }
  return { icon: 'i-tabler-minus', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' };
}

const StatusBadge: Component<StatusBadgeProps> = (props) => {
  const style = () => getStatusStyle(props.status ?? '', props.finished);
  const truncated = () => {
    const s = props.status ?? '–';
    return s.length > 40 ? `${s.slice(0, 37)}…` : s;
  };

  return (
    <span
      class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style().color} ${style().bg}`}
      title={props.status}
    >
      <span class={`${style().icon} w-3 h-3 flex-shrink-0`} />
      <span class="truncate max-w-40">{truncated()}</span>
    </span>
  );
};

export default StatusBadge;
