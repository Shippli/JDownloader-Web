import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { For } from 'solid-js';
import { navItems } from '../../nav';
import { NotificationsPanel } from '../NotificationsPanel';
import { UserPanel } from '../UserPanel';

export const MobileNav: Component = () => {
  const location = useLocation();
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href);

  return (
    <nav
      class="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card flex items-stretch z-50"
    >
      <For each={navItems}>
        {item => (
          <A
            href={item.href}
            title={item.label()}
            class={`flex-1 flex items-center justify-center py-5 transition-colors ${
              isActive(item.href) ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span class={`${item.icon} w-5 h-5`} />
          </A>
        )}
      </For>
      <NotificationsPanel mobile />
      <UserPanel mobile />
    </nav>
  );
};
