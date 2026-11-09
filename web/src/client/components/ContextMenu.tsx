import type { Component } from 'solid-js';
import { useContextMenuContext } from '@kobalte/core/context-menu';
import { useMenuContext } from '@kobalte/core/menu';
import { useLocation } from '@solidjs/router';
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import { cx } from '../lib/cva';
import { activeMenuStore } from '../stores/activeMenu';
import {
  ContextMenuContent,
  ContextMenuItem as ContextMenuItemPrimitive,
  ContextMenuPortal,
  ContextMenu as ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from './ui/ContextMenu';
import { Drawer, DrawerContent, drawerGroupLabelClass, drawerItemClass, DrawerLabel, drawerListClass, drawerSeparatorClass } from './ui/Drawer';

export type ContextMenuItem = {
  label: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  separator?: boolean; // render separator BEFORE this item
  submenu?: ContextMenuItem[];
};

type Props = {
  items: ContextMenuItem[];
  onClose: () => void;
  // Desktop (positioned) mode
  x?: number;
  y?: number;
  // Touch bottom-sheet mode
  touch?: boolean;
  title?: string;
};

// ─── Desktop positioned context menu ─────────────────────────────────────────

const ItemContent: Component<{ item: ContextMenuItem }> = props => (
  <>
    <Show when={props.item.icon}>
      <span class={cx(props.item.icon, 'size-4 shrink-0', !props.item.danger && 'text-muted-foreground')} />
    </Show>
    <span>{props.item.label}</span>
  </>
);

// Opens the trigger-less menu at x/y on mount.
const OpenAt: Component<{ x: number; y: number }> = (props) => {
  const contextMenu = useContextMenuContext();
  const menu = useMenuContext();
  onMount(() => {
    contextMenu.setAnchorRect({ x: props.x, y: props.y });
    menu.open(true);
  });
  return null;
};

const DesktopMenu: Component<{ x: number; y: number; items: ContextMenuItem[]; onClose: () => void }> = (props) => {
  // Selected action; runs once the menu has fully closed so the closing menu
  // can't pull focus away from what the action opens (e.g. a dialog input).
  let pending: (() => void) | undefined;
  onMount(() => activeMenuStore.closeAll());

  return (
    <ContextMenuRoot modal={false}>
      <OpenAt x={props.x} y={props.y} />
      <ContextMenuPortal>
        <ContextMenuContent
          class="z-70 min-w-52"
          onContextMenu={(e: MouseEvent) => e.preventDefault()}
          // Fires after the close animation, when the menu would restore focus.
          onCloseAutoFocus={(e: Event) => {
            const run = pending;
            pending = undefined;
            if (run) {
              e.preventDefault();
            }
            props.onClose();
            run?.();
          }}
        >
          <For each={props.items}>
            {(item, i) => (
              <>
                <Show when={item.separator && i() > 0}>
                  <ContextMenuSeparator />
                </Show>
                <Show
                  when={item.submenu?.length}
                  fallback={(
                    <ContextMenuItemPrimitive variant={item.danger ? 'destructive' : 'default'} onSelect={() => (pending = item.onClick)}>
                      <ItemContent item={item} />
                    </ContextMenuItemPrimitive>
                  )}
                >
                  <ContextMenuSub overlap gutter={4}>
                    <ContextMenuSubTrigger>
                      <ItemContent item={item} />
                    </ContextMenuSubTrigger>
                    <ContextMenuPortal>
                      <ContextMenuSubContent class="z-70 min-w-40">
                        <For each={item.submenu}>
                          {sub => (
                            <ContextMenuItemPrimitive variant={sub.danger ? 'destructive' : 'default'} onSelect={() => (pending = sub.onClick)}>
                              <ItemContent item={sub} />
                            </ContextMenuItemPrimitive>
                          )}
                        </For>
                      </ContextMenuSubContent>
                    </ContextMenuPortal>
                  </ContextMenuSub>
                </Show>
              </>
            )}
          </For>
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenuRoot>
  );
};

// ─── Touch bottom sheet ───────────────────────────────────────────────────────

const TouchSheet: Component<{ title: string; items: ContextMenuItem[]; onClose: () => void }> = (props) => {
  const location = useLocation();
  const [open, setOpen] = createSignal(true);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const close = () => {
    if (!open()) {
      return;
    }
    setOpen(false);
    closeTimer = setTimeout(props.onClose, 350);
  };
  onMount(() => activeMenuStore.closeAll());
  onCleanup(() => clearTimeout(closeTimer));
  createEffect(on(() => location.pathname, close, { defer: true }));

  return (
    <Drawer
      open={open()}
      closeOnOutsidePointerStrategy="pointerdown"
      noOutsidePointerEvents={false}
      trapFocus={false}
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
    >
      <DrawerContent>
        <div class="px-4 py-3 border-b text-center">
          <DrawerLabel class="break-all">{props.title}</DrawerLabel>
        </div>
        <div class={cx(drawerListClass, 'overflow-y-auto')}>
          <For each={props.items}>
            {item => (
              <>
                <Show when={item.separator}>
                  <div class={drawerSeparatorClass} />
                </Show>
                <Show
                  when={item.submenu?.length}
                  fallback={(
                    <button
                      class={drawerItemClass(item.danger)}
                      onClick={() => {
                        item.onClick?.();
                        close();
                      }}
                    >
                      <ItemContent item={item} />
                    </button>
                  )}
                >
                  <p class={drawerGroupLabelClass}>{item.label}</p>
                  <For each={item.submenu}>
                    {sub => (
                      <button
                        class={drawerItemClass(sub.danger)}
                        onClick={() => {
                          sub.onClick?.();
                          close();
                        }}
                      >
                        <ItemContent item={sub} />
                      </button>
                    )}
                  </For>
                </Show>
              </>
            )}
          </For>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// ─── Unified export ───────────────────────────────────────────────────────────

const ContextMenu: Component<Props> = props => (
  <Show
    when={props.touch}
    fallback={<DesktopMenu x={props.x ?? 0} y={props.y ?? 0} items={props.items} onClose={props.onClose} />}
  >
    <TouchSheet title={props.title ?? ''} items={props.items} onClose={props.onClose} />
  </Show>
);

export default ContextMenu;
