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
import { Drawer, DrawerContent, drawerItemClass, DrawerLabel } from './ui/Drawer';

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
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  onMount(() => activeMenuStore.closeAll());
  onCleanup(() => clearTimeout(closeTimer));

  return (
    <ContextMenuRoot
      onOpenChange={(open) => {
        if (!open) {
          closeTimer = setTimeout(props.onClose, 150);
        }
      }}
      modal={false}
    >
      <OpenAt x={props.x} y={props.y} />
      <ContextMenuPortal>
        <ContextMenuContent class="z-70 min-w-52" onContextMenu={(e: MouseEvent) => e.preventDefault()}>
          <For each={props.items}>
            {(item, i) => (
              <>
                <Show when={item.separator && i() > 0}>
                  <ContextMenuSeparator />
                </Show>
                <Show
                  when={item.submenu?.length}
                  fallback={(
                    <ContextMenuItemPrimitive variant={item.danger ? 'destructive' : 'default'} onSelect={() => item.onClick?.()}>
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
                            <ContextMenuItemPrimitive variant={sub.danger ? 'destructive' : 'default'} onSelect={() => sub.onClick?.()}>
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
        <div class="py-1 overflow-y-auto">
          <For each={props.items}>
            {item => (
              <>
                <Show when={item.separator}>
                  <div class="my-1 border-t" />
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
                      <Show when={item.icon}>
                        <span class={`${item.icon} w-4 h-4 flex-shrink-0 ${item.danger ? 'text-destructive' : 'text-muted-foreground'}`} />
                      </Show>
                      <span>{item.label}</span>
                    </button>
                  )}
                >
                  <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1 text-center">{item.label}</p>
                  <For each={item.submenu}>
                    {sub => (
                      <button
                        class={drawerItemClass()}
                        onClick={() => {
                          sub.onClick?.();
                          close();
                        }}
                      >
                        <Show when={sub.icon}>
                          <span class={`${sub.icon} w-4 h-4 flex-shrink-0 text-muted-foreground`} />
                        </Show>
                        <span>{sub.label}</span>
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
