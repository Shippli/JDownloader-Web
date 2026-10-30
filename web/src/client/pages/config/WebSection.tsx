import type { Component } from 'solid-js';
import type { Language } from '../../i18n';
import { For } from 'solid-js';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Switch } from '../../components/ui/Switch';
import { language, languages, setLanguage, t } from '../../i18n';
import { autoNavigateStore } from '../../stores/autoNavigate';
import { compactViewStore } from '../../stores/compactView';
import { debugStore } from '../../stores/debug';

const TOGGLES = [
  { i18nKey: 'config.compactView', store: compactViewStore },
  { i18nKey: 'config.autoNavigate', store: autoNavigateStore },
  { i18nKey: 'config.debugMode', store: debugStore },
];

const WebSection: Component = () => {
  return (
    <div class="flex flex-col gap-4">
      {/* Language */}
      <Card>
        <CardContent>
          <h2 class="text-base font-semibold text-foreground mb-1">{t('config.language.label')}</h2>
          <p class="text-sm text-muted-foreground mb-4">{t('config.language.description')}</p>
          <div class="flex gap-2">
            <For each={Object.entries(languages)}>
              {([code, name]) => (
                <Button
                  variant={language() === code
                    ? 'default'
                    : 'outline'}
                  onClick={() => setLanguage(code as Language)}
                >
                  {name}
                </Button>
              )}
            </For>
          </div>
        </CardContent>
      </Card>

      <For each={TOGGLES}>
        {toggle => (
          <Card>
            <CardContent>
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-base font-semibold text-foreground mb-1">{t(`${toggle.i18nKey}.label`)}</h2>
                  <p class="text-sm text-muted-foreground">{t(`${toggle.i18nKey}.description`)}</p>
                </div>
                <Switch checked={toggle.store.enabled()} onChange={() => toggle.store.toggle()} />
              </div>
            </CardContent>
          </Card>
        )}
      </For>

      {/* About */}
      <Card>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default WebSection;
