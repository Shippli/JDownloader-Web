import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { t } from '../i18n';
import { authStore } from '../stores/auth';
import { themeStore } from '../stores/theme';
import { NavMenu, NavMenuItem, NavMenuSeparator } from './NavMenu';
import { Avatar } from './ui/Avatar';

export const UserMenu: Component<{ collapsed?: boolean; mobile?: boolean }> = (props) => {
  const navigate = useNavigate();
  const isDark = () => themeStore.effectiveTheme() === 'dark';
  const displayName = () => {
    const u = authStore.user();
    return u
      ? (u.name || u.email)
      : undefined;
  };

  const handleSignOut = async () => {
    await authStore.signOut();
    navigate('/login');
  };

  return (
    <NavMenu
      id="user-menu"
      collapsed={props.collapsed}
      mobile={props.mobile}
      icon={<Avatar name={displayName()} size="xs" />}
      label={<span class="whitespace-nowrap truncate">{displayName()}</span>}
      buttonTitle={displayName()}
      heading={displayName() ?? ''}
      subheading={authStore.user()?.name
        ? authStore.user()?.email
        : undefined}
    >
      <NavMenuItem icon="i-tabler-settings" onSelect={() => navigate('/config')}>
        {t('nav.settings')}
      </NavMenuItem>
      <NavMenuItem
        icon={isDark()
          ? 'i-tabler-sun'
          : 'i-tabler-moon'}
        keepOpen
        onSelect={() => themeStore.toggleTheme()}
      >
        {isDark()
          ? t('nav.lightMode')
          : t('nav.darkMode')}
      </NavMenuItem>
      <NavMenuSeparator />
      <NavMenuItem icon="i-tabler-logout" destructive onSelect={handleSignOut}>
        {t('nav.logout')}
      </NavMenuItem>
    </NavMenu>
  );
};
