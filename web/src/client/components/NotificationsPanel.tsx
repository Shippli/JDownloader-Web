import type { Component } from 'solid-js';
import type { PendingOpen } from '../stores/notifications';
import { For, Show } from 'solid-js';
import { t } from '../i18n';
import { activePopupStore } from '../stores/activePopup';
import { dialogTitle, notificationsStore } from '../stores/notifications';
import { NavPopup, navPopupItemClass } from './NavPopup';

type Props = {
  collapsed?: boolean;
  mobile?: boolean;
};

// ─── Panel (popup list in sidebar / mobile nav) ───────────────────────────────

export const NotificationsPanel: Component<Props> = (props) => {
  const { dialogs, captchas, updateAvailable } = notificationsStore;
  const count = () => dialogs().length + captchas().length + (updateAvailable() ? 1 : 0);

  const openItem = (item: NonNullable<PendingOpen>) => {
    activePopupStore.closeAll();
    notificationsStore.openNotification(item);
  };

  return (
    <NavPopup
      id="notifications-panel"
      collapsed={props.collapsed}
      mobile={props.mobile}
      icon={(
        <span class="relative flex items-center justify-center w-5 h-5 shrink-0">
          <span class="i-tabler-bell w-5 h-5" />
          <Show when={count() > 0}>
            <span class="absolute -top-1.5 -right-1.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-destructive text-white text-2xs font-bold flex items-center justify-center leading-none">
              {count() > 9 ? '9+' : count()}
            </span>
          </Show>
        </span>
      )}
      label={<span class="whitespace-nowrap">{t('nav.notifications')}</span>}
      buttonTitle={t('nav.notifications')}
      heading={t('dialogs.title')}
    >
      <div class="max-h-72 overflow-y-auto">
        <Show
          when={count() > 0}
          fallback={<p class="text-sm text-muted-foreground text-center py-6 px-4">{t('dialogs.empty')}</p>}
        >
          <Show when={updateAvailable()}>
            <button onClick={() => openItem({ kind: 'update' })} class={navPopupItemClass(props.mobile)}>
              <span class="i-tabler-refresh-alert w-4 h-4 shrink-0 text-primary" />
              <p class="text-sm font-medium text-foreground truncate">{t('dialogs.updateEntry')}</p>
            </button>
          </Show>
          <For each={captchas()}>
            {entry => (
              <button onClick={() => openItem({ kind: 'captcha', entry })} class={navPopupItemClass(props.mobile)}>
                <span class="i-tabler-shield-lock w-4 h-4 shrink-0 text-warning" />
                <p class="text-sm font-medium text-foreground truncate">
                  {t('captcha.label')}
                  {entry.hoster ? ` — ${entry.hoster}` : ''}
                </p>
              </button>
            )}
          </For>
          <For each={dialogs()}>
            {dialog => (
              <button onClick={() => openItem({ kind: 'dialog', dialog })} class={navPopupItemClass(props.mobile)}>
                <span class="i-tabler-info-circle w-4 h-4 shrink-0 text-info" />
                <p class="text-sm font-medium text-foreground truncate">{dialogTitle(dialog)}</p>
              </button>
            )}
          </For>
        </Show>
      </div>
    </NavPopup>
  );
};
