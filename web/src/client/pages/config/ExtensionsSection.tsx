import type { Component } from 'solid-js';
import type { ConfigEntry, ExtensionEntry } from '../../lib/api';
import {

  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { configEntryKey, ConfigEntryRow, configTypeLabel } from '../../components/ConfigEntryRow';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton, SkeletonList } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { t } from '../../i18n';
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
        <Alert>{error()}</Alert>
      </Show>

      <Show when={loading()}>
        <SkeletonList rows={5} />
      </Show>

      <Show when={!loading() && extensions().length === 0}>
        <EmptyState icon="i-tabler-plug-off" text={t('config.extensions.empty')} class="py-16" />
      </Show>

      <Show when={!loading() && extensions().length > 0}>
        <Card class="overflow-hidden">
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
                          <Badge variant="warning">{t('config.extensions.notInstalled')}</Badge>
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
                        {entry => (
                          <ConfigEntryRow
                            entry={entry}
                            class="pl-8"
                            header={(
                              <>
                                <span class="text-sm font-medium text-foreground">{entry.displayName || entry.key}</span>
                                <Show when={entry.displayName && entry.displayName !== entry.key}>
                                  <Badge class="font-mono">{entry.key}</Badge>
                                </Show>
                                <Badge>{configTypeLabel(entry.abstractType)}</Badge>
                              </>
                            )}
                            editing={editingKey() === configEntryKey(entry)}
                            onEdit={() => setEditingKey(configEntryKey(entry))}
                            onCancel={() => setEditingKey(null)}
                            onSaved={reloadExtSettings}
                            onError={setError}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Card>
      </Show>
    </div>
  );
};

export default ExtensionsSection;
