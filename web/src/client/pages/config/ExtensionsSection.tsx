import type { Component } from 'solid-js';
import type { ConfigEntry, ExtensionEntry } from '../../lib/api';
import {

  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton, SkeletonList } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { t, tf } from '../../i18n';
import { configApi, extensionsApi } from '../../lib/api';

const ExtensionsSection: Component = () => {
  const [extensions, setExtensions] = createSignal<ExtensionEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal<string | null>(null);

  const [expandedExt, setExpandedExt] = createSignal<string | null>(null);
  const [settingsCache, setSettingsCache] = createSignal<Record<string, ConfigEntry[]>>({});
  const [settingsLoading, setSettingsLoading] = createSignal(false);
  const [editingKey, setEditingKey] = createSignal<string | null>(null);
  const [editValue, setEditValue] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const fetchExtensions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await extensionsApi.listExtensions();
      setExtensions((res ?? []) as ExtensionEntry[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => fetchExtensions());

  const toggle = async (ext: ExtensionEntry) => {
    if (!ext.id) {
      return;
    }
    setBusy(ext.id);
    setError('');
    try {
      await extensionsApi.toggleExtension(ext.id, !ext.enabled);
      await fetchExtensions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loadExtSettings = async (ext: ExtensionEntry) => {
    const name = ext.name!;
    if (settingsCache()[name] !== undefined) {
      return;
    }
    const iface = ext.configInterface ?? null;
    if (!iface) {
      setSettingsCache(p => ({ ...p, [name]: [] }));
      return;
    }
    setSettingsLoading(true);
    try {
      const pattern = `${iface}.*`;
      const entries = await configApi.listSettings(pattern);
      setSettingsCache(p => ({ ...p, [name]: entries ?? [] }));
    } catch (e) {
      setError((e as Error).message);
      setSettingsCache(p => ({ ...p, [name]: [] }));
    } finally {
      setSettingsLoading(false);
    }
  };

  const toggleExpand = async (ext: ExtensionEntry) => {
    if (!ext.name) {
      return;
    }
    if (expandedExt() === ext.name) {
      setExpandedExt(null);
      setEditingKey(null);
    } else {
      setExpandedExt(ext.name);
      setEditingKey(null);
      await loadExtSettings(ext);
    }
  };

  const entryKey = (e: ConfigEntry) => `${e.interfaceName}::${e.key}`;

  const isModified = (entry: ConfigEntry) =>
    entry.value != null && entry.defaultValue != null
    && String(entry.value) !== String(entry.defaultValue);

  const startEdit = (entry: ConfigEntry) => {
    setEditingKey(entryKey(entry));
    setEditValue(String(entry.value ?? entry.defaultValue ?? ''));
  };

  const reloadExtSettings = async () => {
    const name = expandedExt();
    if (!name) {
      return;
    }
    const ext = extensions().find(e => e.name === name);
    if (!ext) {
      return;
    }
    setSettingsCache((p) => {
      const n = { ...p };
      delete n[name];
      return n;
    });
    await loadExtSettings(ext);
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
      await reloadExtSettings();
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
      await reloadExtSettings();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ToggleSwitch = (props: { ext: ExtensionEntry }) => {
    const isBusy = () => !!props.ext.id && busy() === props.ext.id;
    return (
      <Switch
        checked={!!props.ext.enabled}
        onChange={() => toggle(props.ext)}
        disabled={isBusy() || !props.ext.installed}
        title={props.ext.enabled ? t('config.extensions.disable') : t('config.extensions.enable')}
      />
    );
  };

  return (
    <div class="space-y-4">
      <Show when={error()}>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
          {error()}
        </div>
      </Show>

      <Show when={loading()}>
        <SkeletonList rows={5} />
      </Show>

      <Show when={!loading() && extensions().length === 0}>
        <div class="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <span class="i-tabler-plug-off w-10 h-10 mb-2" />
          <p class="text-sm">{t('config.extensions.empty')}</p>
        </div>
      </Show>

      <Show when={!loading() && extensions().length > 0}>
        <div class="card overflow-hidden">
          <For each={extensions()}>
            {(ext) => {
              const isExpanded = () => expandedExt() === ext.name;
              const hasConfig = () => !!ext.configInterface && !!ext.installed;
              const extSettings = () => settingsCache()[ext.name ?? ''] ?? [];

              return (
                <div class="border-b last:border-0">
                  <div class="flex items-center gap-3 px-4 py-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-medium text-foreground">{ext.name}</span>
                        <Show when={!ext.installed}>
                          <span class="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                            {t('config.extensions.notInstalled')}
                          </span>
                        </Show>
                      </div>
                      <Show when={ext.description}>
                        <p class="text-xs text-muted-foreground mt-0.5">{ext.description}</p>
                      </Show>
                    </div>

                    <Show when={hasConfig()}>
                      <Button variant="ghost" size="icon" class="shrink-0" onClick={() => toggleExpand(ext)} title={t('config.extensions.openSettings')}>
                        <span class={`i-tabler-settings w-4 h-4 transition-transform duration-200 ${isExpanded() ? 'rotate-45' : ''}`} />
                      </Button>
                    </Show>

                    <ToggleSwitch ext={ext} />
                  </div>

                  <Show when={isExpanded()}>
                    <div class="border-t bg-muted/30">
                      <Show when={settingsLoading() && extSettings().length === 0}>
                        <div class="p-4 flex flex-col gap-3">
                          <Skeleton class="h-4 w-1/2" />
                          <Skeleton class="h-3 w-full" />
                          <Skeleton class="h-3 w-3/4" />
                        </div>
                      </Show>

                      <Show when={!settingsLoading() && extSettings().length === 0}>
                        <p class="text-xs text-muted-foreground px-4 py-4">{t('config.extensions.noSettings')}</p>
                      </Show>

                      <For each={extSettings()}>
                        {(entry) => {
                          const key = () => entryKey(entry);
                          const isEditing = () => editingKey() === key();
                          const aType = entry.abstractType;
                          const label = entry.displayName || entry.key;

                          return (
                            <div class="border-b last:border-0 px-4 py-3 pl-8">
                              <Show
                                when={isEditing()}
                                fallback={(
                                  <div class="flex items-start gap-3">
                                    <div class="flex-1 min-w-0">
                                      <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-sm font-medium text-foreground">{label}</span>
                                        <Show when={entry.displayName && entry.displayName !== entry.key}>
                                          <span class="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{entry.key}</span>
                                        </Show>
                                        <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted-foreground">{aType}</span>
                                      </div>
                                      <Show when={entry.docs}>
                                        <p class="text-xs text-muted-foreground mt-0.5">{entry.docs}</p>
                                      </Show>
                                      <p class={`text-sm mt-1 font-mono ${isModified(entry) ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-foreground'}`}>
                                        {String(entry.value ?? entry.defaultValue ?? '–')}
                                        <Show when={isModified(entry)}>
                                          <span class="ml-2 text-xs font-sans font-normal text-amber-500 opacity-70">
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
                                    <span class="text-sm font-medium text-foreground">{label}</span>
                                    <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted-foreground">{aType}</span>
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
                                          <Input
                                            type={aType === 'INT' || aType === 'LONG' || aType === 'DOUBLE' || aType === 'FLOAT' ? 'number' : 'text'}
                                            value={editValue()}
                                            onInput={e => setEditValue(e.currentTarget.value)}
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
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ExtensionsSection;
