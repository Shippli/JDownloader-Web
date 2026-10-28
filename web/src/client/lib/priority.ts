// @unocss-include
import type { ContextMenuItem } from '../components/ContextMenu';
import { t } from '../i18n';

export const PRIORITIES = [
  { key: 'HIGHEST', labelKey: 'common.priority.highest', icon: 'i-tabler-arrow-bar-up' },
  { key: 'HIGHER', labelKey: 'common.priority.higher', icon: 'i-tabler-arrows-up' },
  { key: 'HIGH', labelKey: 'common.priority.high', icon: 'i-tabler-arrow-up' },
  { key: 'DEFAULT', labelKey: 'common.priority.default', icon: 'i-tabler-minus' },
  { key: 'LOW', labelKey: 'common.priority.low', icon: 'i-tabler-arrow-down' },
] as const;

export type Priority = typeof PRIORITIES[number]['key'];

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
