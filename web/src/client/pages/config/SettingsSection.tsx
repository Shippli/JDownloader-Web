import type { Component } from 'solid-js';
import type { ConfigEntry } from '../../lib/api';
import {

  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { configEntryKey, ConfigEntryRow, configTypeLabel } from '../../components/ConfigEntryRow';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { t } from '../../i18n';
import { configApi } from '../../lib/api';

const SettingsSection: Component = () => {
  const [search, setSearch] = createSignal('');
  const [allEntries, setAllEntries] = createSignal<ConfigEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [editingKey, setEditingKey] = createSignal<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await configApi.listSettings();
      setAllEntries((res ?? []) as ConfigEntry[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => fetchSettings());

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);

  const filteredEntries = () => {
    const q = search().toLowerCase().trim();
    if (!q) {
      return allEntries();
    }
    return allEntries().filter(
      e =>
        e.key.toLowerCase().includes(q)
        || e.interfaceName.toLowerCase().includes(q)
        || (e.docs ?? '').toLowerCase().includes(q),
    );
  };

  createEffect(() => {
    search();
    setVisibleCount(PAGE_SIZE);
  });

  const entries = () => filteredEntries().slice(0, visibleCount());

  const shortInterface = (name: string) => name.split('.').slice(-2).join('.');

  return (
    <div class="space-y-4">
      <div class="relative">
        <span class="i-tabler-search absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <TextField
          type="text"
          value={search()}
          onChange={setSearch}
          placeholder={t('config.settings.searchPlaceholder')}
          inputClass="pl-9"
        />
      </div>

      <Show when={error()}>
        <Alert>{error()}</Alert>
      </Show>

      <Show when={loading()}>
        <SkeletonTable rows={5} />
      </Show>

      <Show when={!loading() && filteredEntries().length === 0}>
        <EmptyState
          icon="i-tabler-settings-off"
          text={allEntries().length > 0
            ? t('config.settings.noResults')
            : t('config.settings.noSettings')}
          class="py-16"
        />
      </Show>

      <Show when={!loading() && filteredEntries().length > 0}>
        <p class="text-xs text-muted-foreground">
          {entries().length}
          {t('config.settings.of')}
          {filteredEntries().length}
          {t('config.settings.entries')}
        </p>
        <Card class="overflow-hidden">
          <For each={entries()}>
            {entry => (
              <ConfigEntryRow
                entry={entry}
                header={(
                  <>
                    <Badge class="font-mono">{shortInterface(entry.interfaceName)}</Badge>
                    <span class="text-sm font-medium text-foreground">{entry.key}</span>
                    <Badge>{configTypeLabel(entry.abstractType)}</Badge>
                  </>
                )}
                editing={editingKey() === configEntryKey(entry)}
                onEdit={() => setEditingKey(configEntryKey(entry))}
                onCancel={() => setEditingKey(null)}
                onSaved={fetchSettings}
                onError={setError}
              />
            )}
          </For>
          <Show when={visibleCount() < filteredEntries().length}>
            <div
              ref={(el) => {
                const observer = new IntersectionObserver(
                  ([e]) => {
                    if (e.isIntersecting) {
                      setVisibleCount(c => c + PAGE_SIZE);
                    }
                  },
                  { rootMargin: '150px' },
                );
                observer.observe(el);
                onCleanup(() => observer.disconnect());
              }}
              class="flex justify-center py-3"
            >
              <span class="i-tabler-loader-2 animate-spin w-5 h-5 text-muted-foreground" />
            </div>
          </Show>
        </Card>
      </Show>
    </div>
  );
};

export default SettingsSection;
