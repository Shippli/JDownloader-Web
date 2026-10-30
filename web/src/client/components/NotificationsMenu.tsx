import type { Component } from 'solid-js';
import type { PendingOpen } from '../stores/notifications';
import { For, Show } from 'solid-js';
import { t } from '../i18n';
import { dialogTitle, notificationsStore } from '../stores/notifications';
import { NavMenu, NavMenuItem } from './NavMenu';

type Props = {
  collapsed?: boolean;
  mobile?: boolean;
};

// ─── Menu (sidebar dropdown / mobile drawer) ─────────────────────────────────

export const NotificationsMenu: Component<Props> = (props) => {
  const { dialogs, captchas, updateAvailable } = notificationsStore;
  const count = () => dialogs().length + captchas().length + (updateAvailable() ? 1 : 0);

  const openItem = (item: NonNullable<PendingOpen>) => notificationsStore.openNotification(item);

  return (
    <NavMenu
      id="notifications-menu"
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
    >
      <div class="max-h-72 overflow-y-auto">
        <Show
          when={count() > 0}
          fallback={<p class="text-sm text-muted-foreground text-center py-6 px-4">{t('dialogs.empty')}</p>}
        >
          <Show when={updateAvailable()}>
            <NavMenuItem icon="i-tabler-refresh-alert text-primary" onSelect={() => openItem({ kind: 'update' })}>
              <span class="truncate">{t('dialogs.updateEntry')}</span>
            </NavMenuItem>
          </Show>
          <For each={captchas()}>
            {entry => (
              <NavMenuItem icon="i-tabler-shield-lock text-warning" onSelect={() => openItem({ kind: 'captcha', entry })}>
                <span class="truncate">
                  {t('captcha.label')}
                  {entry.hoster ? ` — ${entry.hoster}` : ''}
                </span>
              </NavMenuItem>
            )}
          </For>
          <For each={dialogs()}>
            {dialog => (
              <NavMenuItem icon="i-tabler-info-circle text-info" onSelect={() => openItem({ kind: 'dialog', dialog })}>
                <span class="truncate">{dialogTitle(dialog)}</span>
              </NavMenuItem>
            )}
          </For>
        </Show>
      </div>
    </NavMenu>
  );
};
