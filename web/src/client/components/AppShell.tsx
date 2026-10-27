import type { Component, JSX } from 'solid-js';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { startSse, stopSse } from '../stores/sse';
import { NotificationModals } from './NotificationsPanel';
import { MobileNav } from './ui/MobileNav';
import { SideNav } from './ui/SideNav';

const SIDEBAR_KEY = 'sidebar-collapsed';

export const [collapsed, setCollapsed] = createSignal(
  localStorage.getItem(SIDEBAR_KEY) === 'true',
);

export function toggleSidebar() {
  const next = !collapsed();
  setCollapsed(next);
  localStorage.setItem(SIDEBAR_KEY, String(next));
}

export const AppShell: Component<{ children: JSX.Element; layout?: 'default' | 'full' }> = (props) => {
  onMount(() => startSse());
  onCleanup(() => stopSse());

  onMount(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onResize = () => {
      const userPref = localStorage.getItem(SIDEBAR_KEY) === 'true';
      setCollapsed(mq.matches || userPref);
    };

    onResize();
    mq.addEventListener('change', onResize);
    onCleanup(() => mq.removeEventListener('change', onResize));
  });

  return (
    <>
      <NotificationModals />
      <div class="min-h-screen bg-background flex">
        <SideNav />
        <main class="flex-1 overflow-hidden">
          <Show
            when={props.layout === 'full'}
            fallback={(
              <div class="h-full overflow-auto">
                <div class="max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
                  {props.children}
                </div>
              </div>
            )}
          >
            <div class="h-screen flex flex-col">
              {props.children}
            </div>
          </Show>
        </main>
        <MobileNav />
      </div>
    </>
  );
};
