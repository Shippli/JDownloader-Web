import type { Component } from 'solid-js';
import type { Language } from '../../i18n';
import { For } from 'solid-js';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { language, languages, setLanguage, t } from '../../i18n';
import { compactViewStore } from '../../stores/compactView';
import { debugStore } from '../../stores/debug';

const WebSection: Component = () => {
  return (
    <div class="flex flex-col gap-4">
      {/* Language */}
      <div class="card p-6">
        <h2 class="text-base font-semibold text-foreground mb-1">{t('config.language.label')}</h2>
        <p class="text-sm text-muted-foreground mb-4">{t('config.language.description')}</p>
        <div class="flex gap-2">
          <For each={Object.entries(languages)}>
            {([code, name]) => (
              <Button
                variant={language() === code ? 'default' : 'outline'}
                onClick={() => setLanguage(code as Language)}
              >
                {name}
              </Button>
            )}
          </For>
        </div>
      </div>

      {/* Compact view */}
      <div class="card p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-foreground mb-1">{t('config.compactView.label')}</h2>
            <p class="text-sm text-muted-foreground">{t('config.compactView.description')}</p>
          </div>
          <Switch checked={compactViewStore.enabled()} onChange={() => compactViewStore.toggle()} />
        </div>
      </div>

      {/* Debug mode */}
      <div class="card p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-foreground mb-1">{t('config.debugMode.label')}</h2>
            <p class="text-sm text-muted-foreground">{t('config.debugMode.description')}</p>
          </div>
          <Switch checked={debugStore.enabled()} onChange={() => debugStore.toggle()} />
        </div>
      </div>

      {/* About */}
      <div class="card p-6">
        <h2 class="text-base font-semibold text-foreground mb-1">{t('config.about.label')}</h2>
        <p class="text-sm text-muted-foreground mb-4">{t('config.about.description')}</p>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span class="i-tabler-tag w-4 h-4 shrink-0" />
          <span>
            {t('config.about.version')}
            :
            {' '}
            <span class="font-mono text-foreground">{__APP_VERSION__}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default WebSection;
