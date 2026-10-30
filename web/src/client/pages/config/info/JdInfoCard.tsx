import type { Component } from 'solid-js';
import type { JdInfo } from '../../../lib/api';
import { For, Show } from 'solid-js';
import { ConfigSection } from '../../../components/ConfigSection';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonTable } from '../../../components/ui/Skeleton';
import { t } from '../../../i18n';
import { formatDuration } from '../../../lib/api';

type InfoRow = { label: string; value: string; ok?: boolean };

function infoRows(i: JdInfo | undefined): InfoRow[] {
  if (!i) {
    return [];
  }
  const s = i.systemInfos;
  const rows: InfoRow[] = [
    {
      label: t('config.info.status'),
      value: i.version != null
        ? t('config.info.connected')
        : t('config.info.unavailable'),
      ok: i.version != null,
    },
    {
      label: t('config.info.version'),
      value: i.version ?? '–',
    },
    {
      label: t('config.info.revision'),
      value: i.revision != null
        ? String(i.revision)
        : '–',
    },
    {
      label: t('config.info.uptime'),
      value: i.uptime != null
        ? formatDuration(i.uptime)
        : '–',
    },
  ];
  if (s?.hardware) {
    rows.push({
      label: t('config.info.hardware'),
      value: s.hardware,
    });
  }
  if (s?.operatingSystem) {
    rows.push({
      label: t('config.info.os'),
      value: s.operatingSystem,
    });
  }
  return rows;
}

export const JdInfoCard: Component<{ info: JdInfo | undefined; loading: boolean }> = props => (
  <ConfigSection title={t('config.info.jd')}>
    <Show when={!props.loading} fallback={<SkeletonTable rows={3} />}>
      <Show
        when={infoRows(props.info).length > 0}
        fallback={<EmptyState icon="i-tabler-plug-off" text={t('config.info.noConnection')} class="py-8" />}
      >
        <Card class="overflow-hidden">
          <For each={infoRows(props.info)}>
            {row => (
              <div class="flex items-center justify-between px-4 py-3 border-b last:border-0">
                <span class="text-sm text-muted-foreground">{row.label}</span>
                <Show
                  when={row.ok !== undefined}
                  fallback={<span class="text-sm font-mono text-foreground">{row.value}</span>}
                >
                  <span class={`flex items-center gap-1.5 text-sm font-medium ${row.ok ? 'text-success' : 'text-destructive'}`}>
                    <span class={`${row.ok ? 'i-tabler-circle-check' : 'i-tabler-circle-x'} w-4 h-4`} />
                    {row.value}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </Card>
      </Show>
    </Show>
  </ConfigSection>
);
