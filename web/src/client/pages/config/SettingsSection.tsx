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
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Select } from '../../components/ui/Select';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { t, tf } from '../../i18n';
import { configApi } from '../../lib/api';

function getTypeLabel(aType: string) {
  const map: Record<string, string> = {
    INT: 'Int',
    LONG: 'Long',
    DOUBLE: 'Double',
    FLOAT: 'Float',
    BOOLEAN: t('config.settings.typeBool'),
    STRING: t('config.settings.typeString'),
    ENUM: 'Enum',
    STRING_LIST: t('config.settings.typeList'),
  };
  return map[aType] ?? aType;
}

const SettingsSection: Component = () => {
  const [search, setSearch] = createSignal('');
  const [allEntries, setAllEntries] = createSignal<ConfigEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [editingKey, setEditingKey] = createSignal<string | null>(null);
  const [editValue, setEditValue] = createSignal('');
  const [saving, setSaving] = createSignal(false);

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

  const isModified = (entry: ConfigEntry) =>
    entry.value != null
    && entry.defaultValue != null
    && String(entry.value) !== String(entry.defaultValue);

  const entryKey = (e: ConfigEntry) => `${e.interfaceName}::${e.key}`;
  const shortInterface = (name: string) => name.split('.').slice(-2).join('.');

  const startEdit = (entry: ConfigEntry) => {
    setEditingKey(entryKey(entry));
    setEditValue(String(entry.value ?? entry.defaultValue ?? ''));
  };

  const saveEdit = async (entry: ConfigEntry) => {
    setSaving(true);
    setError('');
    try {
      const aType = entry.abstractType;
      let value: unknown = editValue();
      if (aType === 'BOOLEAN') {
        value = editValue() === 'true';
      } else if (aType === 'INT' || aType === 'LONG') {
        value = Number.parseInt(editValue());
      } else if (aType === 'DOUBLE' || aType === 'FLOAT') {
        value = Number.parseFloat(editValue());
      } else if (aType === 'STRING_LIST' || Array.isArray(entry.value) || Array.isArray(entry.defaultValue)) {
        value = editValue().split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      }

      await configApi.setSetting({ interfaceName: entry.interfaceName, storage: entry.storage, key: entry.key, value });
      setEditingKey(null);
      fetchSettings();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetEdit = async (entry: ConfigEntry) => {
    setSaving(true);
    setError('');
    try {
      await configApi.resetSetting({ interfaceName: entry.interfaceName, storage: entry.storage, key: entry.key });
      setEditingKey(null);
      fetchSettings();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

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
        <div class="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
          {error()}
        </div>
      </Show>

      <Show when={loading()}>
        <SkeletonTable rows={5} />
      </Show>

      <Show when={!loading() && filteredEntries().length === 0}>
        <div class="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <span class="i-tabler-settings-off w-10 h-10 mb-2" />
          <p class="text-sm">
            {allEntries().length > 0 ? t('config.settings.noResults') : t('config.settings.noSettings')}
          </p>
        </div>
      </Show>

      <Show when={!loading() && filteredEntries().length > 0}>
        <p class="text-xs text-muted-foreground">
          {entries().length}
          {t('config.settings.of')}
          {filteredEntries().length}
          {t('config.settings.entries')}
        </p>
        <div class="card overflow-hidden">
          <For each={entries()}>
            {(entry) => {
              const key = () => entryKey(entry);
              const isEditing = () => editingKey() === key();
              const aType = entry.abstractType;

              return (
                <div class="border-b last:border-0 px-4 py-3">
                  <Show
                    when={isEditing()}
                    fallback={(
                      <div class="flex items-start gap-3">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {shortInterface(entry.interfaceName)}
                            </span>
                            <span class="text-sm font-medium text-foreground">{entry.key}</span>
                            <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted-foreground">
                              {getTypeLabel(aType)}
                            </span>
                          </div>
                          <Show when={entry.docs}>
                            <p class="text-xs text-muted-foreground mt-0.5">{entry.docs}</p>
                          </Show>
                          <p class={`text-sm mt-1 font-mono ${isModified(entry) ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-foreground'}`}>
                            {String(entry.value ?? entry.defaultValue ?? '–')}
                            <Show when={isModified(entry)}>
                              <span class="ml-2 text-xs font-sans font-normal text-amber-500 dark:text-amber-400 opacity-70">
                                (
                                {tf('config.settings.defaultLabel', String(entry.defaultValue))}
                                )
                              </span>
                            </Show>
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" class="shrink-0" onClick={() => startEdit(entry)} title={t('config.settings.btnEdit')}>
                          <span class="i-tabler-edit w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  >
                    <div class="space-y-2">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {shortInterface(entry.interfaceName)}
                        </span>
                        <span class="text-sm font-medium text-foreground">{entry.key}</span>
                        <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted-foreground">
                          {getTypeLabel(aType)}
                        </span>
                      </div>
                      <Show when={entry.docs}>
                        <p class="text-xs text-muted-foreground">{entry.docs}</p>
                      </Show>
                      <Show
                        when={aType === 'BOOLEAN'}
                        fallback={(
                          <Show
                            when={aType === 'ENUM' && entry.enumOptions && entry.enumOptions.length > 0}
                            fallback={(
                              <TextField
                                type={aType === 'INT' || aType === 'LONG' || aType === 'DOUBLE' || aType === 'FLOAT' ? 'number' : 'text'}
                                value={editValue()}
                                onChange={setEditValue}
                              />
                            )}
                          >
                            <Select
                              value={editValue()}
                              onChange={setEditValue}
                              options={(entry.enumOptions ?? []).map(([val, lbl]) => ({ value: val, label: lbl || val }))}
                            />
                          </Show>
                        )}
                      >
                        <Checkbox
                          checked={editValue() === 'true'}
                          onChange={v => setEditValue(String(v))}
                          label={t('config.settings.enabled')}
                        />
                      </Show>
                      <div class="flex items-center gap-2 flex-wrap justify-end">
                        <Button variant="default" onClick={() => saveEdit(entry)} disabled={saving()}>
                          <Show when={saving()} fallback={<span class="i-tabler-check w-4 h-4" />}>
                            <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
                          </Show>
                          {t('config.settings.save')}
                        </Button>
                        <Button variant="secondary" onClick={() => resetEdit(entry)} disabled={saving()} title={t('config.settings.reset')}>
                          <span class="i-tabler-restore w-4 h-4" />
                          {t('config.settings.reset')}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingKey(null)}>
                          {t('config.settings.cancel')}
                        </Button>
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
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
        </div>
      </Show>
    </div>
  );
};

export default SettingsSection;
