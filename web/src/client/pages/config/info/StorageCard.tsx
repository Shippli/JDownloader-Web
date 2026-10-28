import type { Component } from 'solid-js';
import type { StorageInfo } from '../../../lib/api';
import { createResource, For, Show } from 'solid-js';
import { ConfigSection } from '../../../components/ConfigSection';
import { Card } from '../../../components/ui/Card';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { t } from '../../../i18n';
import { configApi, formatBytes } from '../../../lib/api';

// JD reports one entry per mount path; identical size/free means the same volume.
function uniqueVolumes(infos: StorageInfo[]): StorageInfo[] {
  const seen = new Set<string>();
  return infos.filter((s) => {
    const key = `${s.size}:${s.free}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export const StorageCard: Component = () => {
  const [storage] = createResource(() => configApi.getStorageInfos().then(i => uniqueVolumes(i ?? [])).catch(() => []));

  return (
    <Show when={(storage() ?? []).length > 0}>
      <ConfigSection title={t('config.storage.title')}>
        <Card class="overflow-hidden">
          <For each={storage()}>
            {(s) => {
              const pct = s.size > 0 ? Math.round(((s.size - s.free) / s.size) * 100) : 0;
              const barColor = pct > 90 ? 'red' : pct > 70 ? 'yellow' : 'blue';
              return (
                <div class="px-4 py-3 border-b last:border-0">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-sm font-mono text-foreground truncate mr-4">{s.path}</span>
                    <div class="flex items-center gap-2 shrink-0">
                      <Show when={s.error}>
                        <span class="text-xs text-destructive">{s.error}</span>
                      </Show>
                      <span class="text-xs text-muted-foreground">
                        {`${formatBytes(s.free)} ${t('config.storage.free')} ${t('config.storage.of')} ${formatBytes(s.size)}`}
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={pct} color={barColor} />
                </div>
              );
            }}
          </For>
        </Card>
      </ConfigSection>
    </Show>
  );
};
