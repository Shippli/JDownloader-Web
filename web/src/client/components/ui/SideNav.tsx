import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { For, Show } from 'solid-js';
import { t } from '../../i18n';
import { navItems } from '../../nav';
import { collapsed, toggleSidebar } from '../AppShell';
import { NotificationsPanel } from '../NotificationsPanel';
import { UserPanel } from '../UserPanel';

export const SideNav: Component = () => {
  const location = useLocation();
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href);

  return (
    <aside
      class={`hidden md:flex border-r bg-card flex-col shrink-0 h-screen sticky top-0 transition-all duration-200 overflow-hidden ${collapsed() ? 'w-16' : 'w-64'}`}
    >
      <div class="border-b flex items-center shrink-0 px-4 py-4">
        <button
          onClick={toggleSidebar}
          class="group relative h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 transition-opacity hover:opacity-90"
          title={collapsed() ? t('nav.expand') : t('nav.collapse')}
        >
          <span class="i-tabler-ghost-filled w-5 h-5 text-primary-foreground transition-opacity group-hover:opacity-0" />
          <span class="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Show
              when={collapsed()}
              fallback={<span class="i-tabler-chevron-left w-5 h-5 text-primary-foreground" />}
            >
              <span class="i-tabler-chevron-right w-5 h-5 text-primary-foreground" />
            </Show>
          </span>
        </button>
        <Show when={!collapsed()}>
          <p class="ml-3 font-bold text-base text-foreground whitespace-nowrap">JDownloader</p>
        </Show>
      </div>

      <nav class="flex-1 p-2 space-y-1">
        <For each={navItems}>
          {item => (
            <A
              href={item.href}
              class={`flex items-center gap-3 rounded-lg px-3 h-9 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              title={collapsed() ? item.label() : undefined}
            >
              <span class={`${item.icon} w-5 h-5 shrink-0`} />
              <Show when={!collapsed()}>
                <span class="whitespace-nowrap">{item.label()}</span>
              </Show>
            </A>
          )}
        </For>
      </nav>

      <div class="p-2 border-t space-y-1">
        <NotificationsPanel collapsed={collapsed()} />
        <UserPanel collapsed={collapsed()} />
      </div>
    </aside>
  );
};
