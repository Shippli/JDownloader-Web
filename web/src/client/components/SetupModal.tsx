import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { t } from '../i18n';
import { configApi } from '../lib/api';
import { connectionStore } from '../stores/connection';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export const SetupModal: Component = () => {
  const [host, setHost] = createSignal('');
  const [port, setPort] = createSignal('3128');
  const [testing, setTesting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSave = async () => {
    if (!host().trim() || !port().trim()) {
      return;
    }
    setTesting(true);
    setError(null);
    try {
      await configApi.setConnection(host().trim(), port().trim());
      const result = await configApi.testConnection();
      if (result.ok) {
        connectionStore.setConfigured(true);
      } else {
        setError(result.error ?? t('setup.connectError'));
      }
    } catch (e) {
      setError((e as Error).message ?? t('setup.connectError'));
    } finally {
      setTesting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <Show when={connectionStore.configured() === false}>
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
        <div class="bg-card rounded-xl shadow-xl w-full max-w-sm">
          <div class="px-6 py-5 border-b flex items-center gap-3">
            <span class="i-tabler-plug-connected w-5 h-5 text-primary" />
            <h2 class="text-base font-semibold text-foreground">{t('setup.title')}</h2>
          </div>

          <div class="px-6 py-5 space-y-4">
            <p class="text-sm text-muted-foreground">{t('setup.description')}</p>

            <div class="space-y-3">
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">{t('setup.host')}</label>
                <Input
                  type="text"
                  placeholder={t('setup.hostPlaceholder')}
                  value={host()}
                  onInput={e => setHost(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  disabled={testing()}
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">{t('setup.port')}</label>
                <Input
                  type="text"
                  placeholder="3128"
                  value={port()}
                  onInput={e => setPort(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  disabled={testing()}
                />
              </div>
            </div>

            <Show when={error()}>
              <div class="flex items-center gap-2 text-sm text-destructive">
                <span class="i-tabler-alert-circle w-4 h-4 shrink-0" />
                {error()}
              </div>
            </Show>
          </div>

          <div class="px-6 py-4 border-t">
            <Button
              class="w-full"
              onClick={handleSave}
              disabled={testing() || !host().trim() || !port().trim()}
            >
              <Show
                when={testing()}
                fallback={(
                  <>
                    <span class="i-tabler-plug-connected w-4 h-4 mr-2" />
                    {t('setup.connect')}
                  </>
                )}
              >
                <span class="i-tabler-loader-2 animate-spin w-4 h-4 mr-2" />
                {t('setup.connecting')}
              </Show>
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
};
