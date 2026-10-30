import type { Component, JSX } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { createContext, createEffect, on, Show, untrack, useContext } from 'solid-js';
import { cx } from '../lib/cva';
import { activeMenuStore } from '../stores/activeMenu';
import { Drawer, DrawerContent, drawerItemClass, DrawerLabel } from './ui/Drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/DropdownMenu';

type NavMenuProps = {
  // Unique per panel; suffixed per variant so desktop and mobile instances don't clash.
  id: string;
  collapsed?: boolean;
  mobile?: boolean;
  // Button content: icon always, label only in the expanded sidebar.
  icon: JSX.Element;
  label: JSX.Element;
  buttonTitle?: string;
  heading?: string;
  subheading?: string;
  children: JSX.Element;
};

const NavMenuContext = createContext<{ mobile: boolean; close: () => void }>();

// Sidebar (desktop: dropdown menu) / bottom-nav (mobile: drawer) menu.
export const NavMenu: Component<NavMenuProps> = (props) => {
  const id = `${untrack(() => props.id)}-${untrack(() => props.mobile) ? 'mobile' : 'desktop'}`;
  const isOpen = () => activeMenuStore.active() === id;
  const setOpen = (open: boolean) => open ? activeMenuStore.open(id) : activeMenuStore.close(id);
  let buttonRef: HTMLButtonElement | undefined;

  const location = useLocation();
  createEffect(on(() => location.pathname, () => activeMenuStore.close(id), { defer: true }));

  return (
    <NavMenuContext.Provider value={{ mobile: !!untrack(() => props.mobile), close: () => setOpen(false) }}>
      <Show
        when={props.mobile}
        fallback={(
          <DropdownMenu open={isOpen()} onOpenChange={setOpen} placement="top-start">
            <DropdownMenuTrigger
              class="flex items-center gap-3 w-full rounded-lg px-3 h-9 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title={props.collapsed ? props.buttonTitle : undefined}
            >
              {props.icon}
              <Show when={!props.collapsed}>{props.label}</Show>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent class={cx('z-210', props.collapsed ? 'w-60' : 'w-(--kb-popper-anchor-width)')}>
                <DropdownMenuGroup>
                  <Show when={props.heading}>
                    <DropdownMenuGroupLabel class="truncate">
                      {props.heading}
                      <Show when={props.subheading}>
                        <p class="text-xs font-normal text-muted-foreground truncate">{props.subheading}</p>
                      </Show>
                    </DropdownMenuGroupLabel>
                    <DropdownMenuSeparator />
                  </Show>
                  {props.children}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        )}
      >
        <div class="relative flex-1">
          <button
            ref={buttonRef}
            onClick={() => setOpen(!isOpen())}
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
                activeMenuStore.close(id);
              }
            }}
          >
            <DrawerContent>
              <div class="flex flex-col min-h-0">
                <Show when={props.heading}>
                  <div class="px-4 py-3 border-b text-center">
                    <DrawerLabel class="block truncate">{props.heading}</DrawerLabel>
                    <Show when={props.subheading}>
                      <p class="text-xs text-muted-foreground truncate mt-0.5">{props.subheading}</p>
                    </Show>
                  </div>
                </Show>
                {props.children}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </Show>
    </NavMenuContext.Provider>
  );
};

type NavMenuItemProps = {
  // Icon class; may include a text color to override the muted default.
  icon: string;
  onSelect: () => void;
  destructive?: boolean;
  keepOpen?: boolean;
  children: JSX.Element;
};

// Menu item on desktop, drawer row on mobile. Closes the menu unless keepOpen.
export const NavMenuItem: Component<NavMenuItemProps> = (props) => {
  const ctx = useContext(NavMenuContext)!;
  const icon = () => (
    <span class={cx('size-4 shrink-0', props.destructive ? 'text-destructive' : 'text-muted-foreground', props.icon)} />
  );
  return (
    <Show
      when={ctx.mobile}
      fallback={(
        <DropdownMenuItem variant={props.destructive ? 'destructive' : 'default'} closeOnSelect={!props.keepOpen} onSelect={() => props.onSelect()}>
          {icon()}
          {props.children}
        </DropdownMenuItem>
      )}
    >
      <button
        class={drawerItemClass(props.destructive)}
        onClick={() => {
          props.onSelect();
          if (!props.keepOpen) {
            ctx.close();
          }
        }}
      >
        {icon()}
        {props.children}
      </button>
    </Show>
  );
};

export const NavMenuSeparator: Component = () => {
  const ctx = useContext(NavMenuContext)!;
  return (
    <Show when={ctx.mobile} fallback={<DropdownMenuSeparator />}>
      <div class="my-1 border-t" />
    </Show>
  );
};
