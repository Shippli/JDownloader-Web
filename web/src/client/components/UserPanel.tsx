import type { Component } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { t } from '../i18n';
import { activePopupStore } from '../stores/activePopup';
import { authStore } from '../stores/auth';
import { themeStore } from '../stores/theme';
import { NavPopup, navPopupItemClass } from './NavPopup';
import { Avatar } from './ui/Avatar';

export const UserPanel: Component<{ collapsed?: boolean; mobile?: boolean }> = (props) => {
  const navigate = useNavigate();
  const isDark = () => themeStore.effectiveTheme() === 'dark';
  const displayName = () => {
    const u = authStore.user();
    return u ? (u.name || u.email) : undefined;
  };

  const handleSignOut = async () => {
    activePopupStore.closeAll();
    await authStore.signOut();
    navigate('/login');
  };

  return (
    <NavPopup
      id="user-panel"
      collapsed={props.collapsed}
      mobile={props.mobile}
      icon={<Avatar name={displayName()} size="xs" />}
      label={<span class="whitespace-nowrap truncate">{displayName()}</span>}
      buttonTitle={displayName()}
      heading={displayName() ?? ''}
      subheading={authStore.user()?.name ? authStore.user()?.email : undefined}
    >
      <div class="py-1">
        <A href="/config" onClick={() => activePopupStore.closeAll()} class={navPopupItemClass(props.mobile)}>
          <span class="i-tabler-settings w-4 h-4 text-muted-foreground" />
          {t('nav.settings')}
        </A>
        <button onClick={() => themeStore.toggleTheme()} class={navPopupItemClass(props.mobile)}>
          <span class={`${isDark() ? 'i-tabler-sun' : 'i-tabler-moon'} w-4 h-4 text-muted-foreground`} />
          {isDark() ? t('nav.lightMode') : t('nav.darkMode')}
        </button>
        <div class="my-1 border-t" />
        <button onClick={handleSignOut} class={navPopupItemClass(props.mobile, 'text-destructive')}>
          <span class="i-tabler-logout w-4 h-4" />
          {t('nav.logout')}
        </button>
      </div>
    </NavPopup>
  );
};
