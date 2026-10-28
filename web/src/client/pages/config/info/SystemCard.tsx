import type { Component } from 'solid-js';
import { createSignal, For, onMount, Show } from 'solid-js';
import { ConfigSection } from '../../../components/ConfigSection';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Switch';
import { t } from '../../../i18n';
import { configApi } from '../../../lib/api';

const ACTIONS = [
  { key: 'updateCheck', labelKey: 'config.system.runUpdateCheck', icon: 'i-tabler-refresh', run: () => configApi.runUpdateCheck() },
  { key: 'restart', labelKey: 'config.system.restart', icon: 'i-tabler-rotate-clockwise', run: () => configApi.restartJD() },
  { key: 'restartUpdate', labelKey: 'config.system.restartAndUpdate', icon: 'i-tabler-refresh-dot', run: () => configApi.restartAndUpdate() },
] as const;

export const SystemCard: Component = () => {
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal('');
  const [updateCheckDone, setUpdateCheckDone] = createSignal(false);
  const [autoUpdate, setAutoUpdate] = createSignal(false);
  const [autoUpdateSaving, setAutoUpdateSaving] = createSignal(false);

  onMount(async () => {
    try {
      setAutoUpdate((await configApi.getAutoUpdate()).enabled);
    } catch { /* jd unavailable */ }
  });

  const toggleAutoUpdate = async (v: boolean) => {
    const prev = autoUpdate();
    setAutoUpdate(v);
    setAutoUpdateSaving(true);
    setError('');
    try {
      await configApi.setAutoUpdate(v);
    } catch (err) {
      setAutoUpdate(prev);
      setError((err as Error).message);
    } finally {
      setAutoUpdateSaving(false);
    }
  };

  const runAction = async (action: typeof ACTIONS[number]) => {
    setBusy(action.key);
    setError('');
    setUpdateCheckDone(false);
    try {
      await action.run();
      setUpdateCheckDone(action.key === 'updateCheck');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ConfigSection title={t('config.system.title')}>
      <Card class="overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b last:border-0">
          <div class="flex items-center gap-2">
            <span class="i-tabler-cloud-download w-4 h-4 text-muted-foreground" />
            <div>
              <p class="text-sm text-foreground">{t('config.system.autoUpdate')}</p>
              <p class="text-xs text-muted-foreground">{t('config.system.autoUpdateHint')}</p>
            </div>
          </div>
          <Switch checked={autoUpdate()} onChange={toggleAutoUpdate} disabled={autoUpdateSaving()} />
        </div>
        <For each={ACTIONS}>
          {action => (
            <div class="flex items-center justify-between px-4 py-3 border-b last:border-0">
              <div class="flex items-center gap-2">
                <span class={`${action.icon} w-4 h-4 text-muted-foreground`} />
                <span class="text-sm text-foreground">{t(action.labelKey)}</span>
              </div>
              <Button
                variant="secondary"
                onClick={() => runAction(action)}
                disabled={busy() !== null}
                loading={busy() === action.key}
                icon={action.icon}
              >
                {t('config.system.run')}
              </Button>
            </div>
          )}
        </For>
        <Show when={error()}>
          <div class="px-4 py-2 text-xs text-destructive">{error()}</div>
        </Show>
        <Show when={updateCheckDone()}>
          <div class="px-4 py-2 text-xs text-success">{t('config.system.updateCheckDone')}</div>
        </Show>
      </Card>
    </ConfigSection>
  );
};
