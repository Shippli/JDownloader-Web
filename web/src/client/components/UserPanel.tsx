import type { Component } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '../i18n';
import { activePopupStore } from '../stores/activePopup';
import { authStore } from '../stores/auth';
import { themeStore } from '../stores/theme';
import { Avatar } from './ui/Avatar';

type Props = {
  collapsed?: boolean;
  mobile?: boolean;
};

export const UserPanel: Component<Props> = (props) => {
  const navigate = useNavigate();
  const PANEL_ID = props.mobile ? 'user-panel-mobile' : 'user-panel-desktop';
  const [popupPos, setPopupPos] = createSignal({ bottom: 0, left: 0, width: 240 });

  const isOpen = () => activePopupStore.active() === PANEL_ID;

  let buttonRef: HTMLButtonElement | undefined;
  let popupRef: HTMLDivElement | undefined;

  const isDark = () => themeStore.effectiveTheme() === 'dark';

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      activePopupStore.close(PANEL_ID);
    }
  };
  onMount(() => document.addEventListener('keydown', onKeyDown));
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  // Close on any click outside the popup
  createEffect(() => {
    if (!isOpen()) {
      return;
    }
    let enabled = false;
    const timer = setTimeout(() => {
      enabled = true;
    }, 0);
    const onOutsideClick = (e: MouseEvent) => {
      if (!enabled) {
        return;
      }
      if (popupRef?.contains(e.target as Node)) {
        return;
      }
      activePopupStore.close(PANEL_ID);
    };
    document.addEventListener('click', onOutsideClick);
    onCleanup(() => {
      clearTimeout(timer);
      document.removeEventListener('click', onOutsideClick);
    });
  });

  const handleSignOut = async () => {
    activePopupStore.closeAll();
    await authStore.signOut();
    navigate('/login');
  };

  const toggleDesktop = () => {
    if (!isOpen() && buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      setPopupPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
      activePopupStore.open(PANEL_ID);
    } else {
      activePopupStore.closeAll();
    }
  };

  const avatarName = () => {
    const u = authStore.user();
    return u ? (u.name || u.email) : undefined;
  };

  const Popup = () => (
    <div class={`bg-card border overflow-hidden ${props.mobile ? 'rounded-t-xl border-b-0 w-full shadow-[0_-8px_24px_rgba(0,0,0,0.1)]' : 'rounded-xl shadow-xl'}`}>
      <div class={`px-4 py-3 border-b ${props.mobile ? 'text-center' : ''}`}>
        <p class="text-sm font-semibold text-foreground truncate">
          {authStore.user()?.name || authStore.user()?.email}
        </p>
        <Show when={authStore.user()?.name}>
          <p class="text-xs text-muted-foreground truncate mt-0.5">{authStore.user()?.email}</p>
        </Show>
      </div>
      <div class="py-1">
        <A
          href="/config"
          onClick={() => activePopupStore.closeAll()}
          class={`flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors ${props.mobile ? 'justify-center' : ''}`}
        >
          <span class="i-tabler-settings w-4 h-4 text-muted-foreground" />
          {t('nav.settings')}
        </A>
        <button
          onClick={() => {
            themeStore.toggleTheme();
          }}
          class={`flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors ${props.mobile ? 'justify-center' : ''}`}
        >
          <Show
            when={isDark()}
            fallback={<span class="i-tabler-moon w-4 h-4 text-muted-foreground" />}
          >
            <span class="i-tabler-sun w-4 h-4 text-muted-foreground" />
          </Show>
          {isDark() ? t('nav.lightMode') : t('nav.darkMode')}
        </button>
        <div class="my-1 border-t" />
        <button
          onClick={handleSignOut}
          class={`flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-accent transition-colors ${props.mobile ? 'justify-center' : ''}`}
        >
          <span class="i-tabler-logout w-4 h-4" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <Show
      when={props.mobile}
      fallback={(
        <div>
          <button
            ref={buttonRef}
            onClick={toggleDesktop}
            class="flex items-center gap-3 w-full rounded-lg px-3 h-9 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title={props.collapsed ? (authStore.user()?.name || authStore.user()?.email) : undefined}
          >
            <Avatar name={avatarName()} size="xs" />
            <Show when={!props.collapsed}>
              <span class="whitespace-nowrap truncate">
                {authStore.user()?.name || authStore.user()?.email}
              </span>
            </Show>
          </button>
          <Show when={isOpen()}>
            <Portal>
              <div
                ref={popupRef}
                class="fixed z-[210]"
                style={{ bottom: `${popupPos().bottom}px`, left: `${popupPos().left}px`, width: `${popupPos().width}px` }}
              >
                <Popup />
              </div>
            </Portal>
          </Show>
        </div>
      )}
    >
      {/* Mobile bottom-nav */}
      <div class="relative flex-1">
        <button
          onClick={() => {
            isOpen() ? activePopupStore.closeAll() : activePopupStore.open(PANEL_ID);
          }}
          ref={buttonRef}
          title={authStore.user()?.name || authStore.user()?.email}
          class="w-full flex items-center justify-center py-5 text-muted-foreground"
        >
          <Avatar name={avatarName()} size="xs" />
        </button>
        <Show when={isOpen()}>
          <div ref={popupRef} class="fixed bottom-[61px] left-0 right-0 z-[210]">
            <Popup />
          </div>
        </Show>
      </div>
    </Show>
  );
};
