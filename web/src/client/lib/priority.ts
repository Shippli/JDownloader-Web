// @unocss-include
import type { ContextMenuItem } from '../components/ContextMenu';
import { t } from '../i18n';

// variant: badge color; none for DEFAULT (no badge shown).
export const PRIORITIES = [
  { key: 'HIGHEST', labelKey: 'common.priority.highest', icon: 'i-tabler-arrow-bar-up', variant: 'danger' },
  { key: 'HIGHER', labelKey: 'common.priority.higher', icon: 'i-tabler-arrows-up', variant: 'warning' },
  { key: 'HIGH', labelKey: 'common.priority.high', icon: 'i-tabler-arrow-up', variant: 'warning' },
  { key: 'DEFAULT', labelKey: 'common.priority.default', icon: 'i-tabler-minus', variant: undefined },
  { key: 'LOW', labelKey: 'common.priority.low', icon: 'i-tabler-arrow-down', variant: 'default' },
] as const;

export type Priority = typeof PRIORITIES[number]['key'];

// JD's LOWER is shown as LOW.
export function priorityInfo(priority: string | undefined) {
  const key = priority === 'LOWER' ? 'LOW' : priority;
  return PRIORITIES.find(p => p.key === key);
}

// Desktop: submenu; touch: opens the priority dialog instead.
export function priorityMenuItem(touch: boolean | undefined, openDialog: () => void, setPriority: (p: Priority) => void): ContextMenuItem {
  return {
    label: t('common.priority.label'),
    icon: 'i-tabler-sort-ascending',
    ...(touch
      ? { onClick: openDialog }
      : { submenu: PRIORITIES.map(p => ({ label: t(p.labelKey), icon: p.icon, onClick: () => setPriority(p.key) })) }),
  };
}
