import type { Component, JSX } from 'solid-js';
import { createEffect, createSignal, onMount } from 'solid-js';
import { connectionStore } from '../stores/connection';
import { SetupModal } from './SetupModal';
import { MobileNav } from './ui/MobileNav';
import { SideNav } from './ui/SideNav';

export const [collapsed, setCollapsed] = createSignal(
  localStorage.getItem('sidebar-collapsed') === 'true',
);

// Keep --sidebar-w in sync so TouchSheet can position itself correctly on desktop
document.documentElement.style.setProperty('--sidebar-w', collapsed() ? '64px' : '256px');

export function toggleSidebar() {
  const next = !collapsed();
  setCollapsed(next);
  localStorage.setItem('sidebar-collapsed', String(next));
}

export function syncSidebarWidth() {
  createEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed() ? '64px' : '256px');
  });
}

export const AppShell: Component<{ children: JSX.Element }> = (props) => {
  syncSidebarWidth();
  onMount(() => connectionStore.check());

  return (
    <>
      <SetupModal />
      <div class="min-h-screen bg-background flex">
        <SideNav />
        <main class="flex-1 overflow-auto">
          <div class="max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
            {props.children}
          </div>
        </main>
        <MobileNav />
      </div>
    </>
  );
};
