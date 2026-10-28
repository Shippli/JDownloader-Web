import type { Component, JSX } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { createEffect, createSignal, on, onCleanup, Show, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { onClickOutside } from '../lib/clickOutside';
import { cx } from '../lib/cva';
import { activePopupStore } from '../stores/activePopup';
import { Drawer, DrawerContent, DrawerLabel } from './ui/Drawer';

type NavPopupProps = {
  // Unique per panel; suffixed per variant so desktop and mobile instances don't clash.
  id: string;
  collapsed?: boolean;
  mobile?: boolean;
  // Button content: icon always, label only in the expanded sidebar.
  icon: JSX.Element;
  label: JSX.Element;
  buttonTitle?: string;
  heading: string;
  subheading?: string;
  children: JSX.Element;
};

// Sidebar (desktop: anchored popover) / bottom-nav (mobile: drawer) popup.
export const NavPopup: Component<NavPopupProps> = (props) => {
  const id = `${untrack(() => props.id)}-${untrack(() => props.mobile) ? 'mobile' : 'desktop'}`;
  const isOpen = () => activePopupStore.active() === id;
  const [pos, setPos] = createSignal({ bottom: 0, left: 0, width: 240 });
  let buttonRef: HTMLButtonElement | undefined;
  let popupRef: HTMLDivElement | undefined;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      activePopupStore.close(id);
    }
  };
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  const location = useLocation();
  createEffect(on(() => location.pathname, () => activePopupStore.close(id), { defer: true }));

  createEffect(() => {
    if (isOpen() && !props.mobile) {
      onClickOutside(() => popupRef, () => activePopupStore.close(id));
    }
  });

  const toggle = () => {
    if (isOpen()) {
      activePopupStore.closeAll();
      return;
    }
    if (!props.mobile && buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: props.collapsed ? 240 : rect.width });
    }
    activePopupStore.open(id);
  };

  const content = () => (
    <div class={props.mobile ? 'flex flex-col min-h-0' : 'bg-card border overflow-hidden rounded-xl shadow-xl'}>
      <div class={cx('px-4 py-3 border-b', props.mobile && 'text-center')}>
        <Show when={props.mobile} fallback={<p class="text-sm font-semibold text-foreground truncate">{props.heading}</p>}>
          <DrawerLabel class="block truncate">{props.heading}</DrawerLabel>
        </Show>
        <Show when={props.subheading}>
          <p class="text-xs text-muted-foreground truncate mt-0.5">{props.subheading}</p>
        </Show>
      </div>
      {props.children}
    </div>
  );

  return (
    <Show
      when={props.mobile}
      fallback={(
        <div>
          <button
            ref={buttonRef}
            onClick={toggle}
            class="flex items-center gap-3 w-full rounded-lg px-3 h-9 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title={props.collapsed ? props.buttonTitle : undefined}
          >
            {props.icon}
            <Show when={!props.collapsed}>{props.label}</Show>
          </button>
          <Show when={isOpen()}>
            <Portal>
              <div
                ref={popupRef}
                class="fixed z-210 bottom-(--popup-bottom) left-(--popup-left) w-(--popup-width)"
                style={{ '--popup-bottom': `${pos().bottom}px`, '--popup-left': `${pos().left}px`, '--popup-width': `${pos().width}px` }}
              >
                {content()}
              </div>
            </Portal>
          </Show>
        </div>
      )}
    >
      <div class="relative flex-1">
        <button
          ref={buttonRef}
          onClick={toggle}
          title={props.buttonTitle}
          class="w-full flex items-center justify-center py-5 text-muted-foreground"
        >
          {props.icon}
        </button>
        <Drawer
          open={isOpen()}
          closeOnOutsidePointerStrategy="pointerdown"
          noOutsidePointerEvents={false}
          trapFocus={false}
          onOutsidePointer={(e) => {
            if (buttonRef?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
          onOpenChange={(open) => {
            if (!open) {
              activePopupStore.close(id);
            }
          }}
        >
          <DrawerContent>{content()}</DrawerContent>
        </Drawer>
      </div>
    </Show>
  );
};

// Row style for items inside a NavPopup.
export function navPopupItemClass(mobile?: boolean, extra?: string) {
  return cx('flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-accent transition-colors', mobile && 'justify-center', extra ?? 'text-foreground');
}
