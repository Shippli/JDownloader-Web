import type { Component } from 'solid-js';
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { activePopupStore } from '../stores/activePopup';

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

const DesktopMenu: Component<{ x: number; y: number; items: ContextMenuItem[]; onClose: () => void }> = (props) => {
  let ref!: HTMLDivElement;
  const [pos, setPos] = createSignal({ x: props.x, y: props.y });
  const [subIdx, setSubIdx] = createSignal<number | null>(null);
  const [subOpenLeft, setSubOpenLeft] = createSignal(false);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  const openSub = (idx: number) => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (subIdx() === idx) {
      return;
    }
    if (openTimer) {
      return;
    }
    openTimer = setTimeout(() => {
      const menuRight = pos().x + (ref?.getBoundingClientRect().width ?? 220);
      setSubOpenLeft(window.innerWidth - menuRight < 220);
      setSubIdx(idx);
      openTimer = null;
    }, 180);
  };
  const cancelOpen = () => {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  };
  const closeSub = () => {
    cancelOpen();
    closeTimer = setTimeout(() => {
      setSubIdx(null);
      closeTimer = null;
    }, 80);
  };

  onMount(() => {
    activePopupStore.closeAll();
    const { width, height } = ref.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(props.x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(props.y, window.innerHeight - height - 8)),
    });

    // Close on outside click or right-click
    let enabled = false;
    const timer = setTimeout(() => {
      enabled = true;
    }, 0);
    const onOutsideClick = (e: MouseEvent) => {
      if (!enabled) {
        return;
      }
      if (ref.contains(e.target as Node)) {
        return;
      }
      props.onClose();
    };
    const onOutsideCtx = (e: MouseEvent) => {
      e.preventDefault();
      if (ref.contains(e.target as Node)) {
        return;
      }
      props.onClose();
    };
    document.addEventListener('click', onOutsideClick);
    document.addEventListener('contextmenu', onOutsideCtx);
    onCleanup(() => {
      clearTimeout(timer);
      document.removeEventListener('click', onOutsideClick);
      document.removeEventListener('contextmenu', onOutsideCtx);
    });
  });

  const btnClass = (item: ContextMenuItem) =>
    `w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
      item.danger
        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
        : 'text-foreground hover:bg-accent'
    }`;

  return (
    <div
      ref={ref}
      class="fixed bg-card border rounded-xl shadow-xl py-1.5 min-w-[210px] z-[70]"
      style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
    >
      <For each={props.items}>
        {(item, i) => (
          <>
            <Show when={item.separator && i() > 0}>
              <div style={{ height: '1px', background: 'hsl(var(--muted-foreground) / 0.2)', margin: '4px 8px' }} />
            </Show>
            <Show
              when={item.submenu?.length}
              fallback={(
                <button
                  class={btnClass(item)}
                  onClick={() => {
                    item.onClick?.();
                    props.onClose();
                  }}
                >
                  <Show when={item.icon}><span class={`${item.icon} w-4 h-4 flex-shrink-0`} /></Show>
                  <span>{item.label}</span>
                </button>
              )}
            >
              <div
                class="relative"
                onMouseEnter={() => openSub(i())}
                onMouseLeave={() => {
                  cancelOpen();
                  closeSub();
                }}
              >
                <button class={`${btnClass(item)} justify-between`}>
                  <div class="flex items-center gap-3">
                    <Show when={item.icon}><span class={`${item.icon} w-4 h-4 flex-shrink-0`} /></Show>
                    <span>{item.label}</span>
                  </div>
                  <span class={`${subIdx() === i() && subOpenLeft() ? 'i-tabler-chevron-left' : 'i-tabler-chevron-right'} w-3.5 h-3.5 text-muted-foreground flex-shrink-0`} />
                </button>
                <Show when={subIdx() === i()}>
                  {/* Transparent bridge fills the gap so mouse movement doesn't trigger onMouseLeave */}
                  <div
                    class={`absolute top-0 h-full w-2 ${subOpenLeft() ? 'right-full' : 'left-full'}`}
                    onMouseEnter={() => openSub(i())}
                  />
                  <div
                    class={`absolute top-1/2 -translate-y-1/2 bg-card border rounded-xl shadow-xl py-1.5 min-w-[160px] z-10 ${subOpenLeft() ? 'right-full mr-2' : 'left-full ml-2'}`}
                    onMouseEnter={() => openSub(i())}
                    onMouseLeave={closeSub}
                  >
                    <For each={item.submenu}>
                      {sub => (
                        <button
                          class="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-accent text-foreground transition-colors"
                          onClick={() => {
                            sub.onClick?.();
                            props.onClose();
                          }}
                        >
                          <Show when={sub.icon}><span class={`${sub.icon} w-4 h-4 flex-shrink-0`} /></Show>
                          <span>{sub.label}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </>
        )}
      </For>
    </div>
  );
};

// ─── Touch bottom sheet ───────────────────────────────────────────────────────

const TouchSheet: Component<{ title: string; items: ContextMenuItem[]; onClose: () => void }> = (props) => {
  let ref: HTMLDivElement | undefined;

  onMount(() => {
    activePopupStore.closeAll();
    let enabled = false;
    const timer = setTimeout(() => {
      enabled = true;
    }, 0);
    const onOutsideClick = (e: MouseEvent) => {
      if (!enabled) {
        return;
      }
      if (ref?.contains(e.target as Node)) {
        return;
      }
      props.onClose();
    };
    document.addEventListener('click', onOutsideClick);
    onCleanup(() => {
      clearTimeout(timer);
      document.removeEventListener('click', onOutsideClick);
    });
  });

  return (
    <div class="fixed bottom-[61px] left-0 right-0 z-[61] md:bottom-0 md:left-[var(--sidebar-w)]">
      <div class="md:max-w-5xl md:mx-auto md:px-8">
        <div ref={ref} class="bg-card border border-b-0 overflow-hidden rounded-t-xl w-full shadow-[0_-8px_24px_rgba(0,0,0,0.1)]">
          <div class="px-4 py-3 border-b text-center">
            <span class="text-sm font-semibold text-foreground break-all">{props.title}</span>
          </div>
          <div class="py-1 overflow-y-auto max-h-[60vh]">
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
                        class={`flex items-center gap-3 justify-center w-full px-4 py-3 text-sm transition-colors ${
                          item.danger
                            ? 'text-red-500 hover:bg-accent'
                            : 'text-foreground hover:bg-accent'
                        }`}
                        onClick={() => {
                          item.onClick?.();
                          props.onClose();
                        }}
                      >
                        <Show when={item.icon}>
                          <span class={`${item.icon} w-4 h-4 flex-shrink-0 ${item.danger ? 'text-red-500' : 'text-muted-foreground'}`} />
                        </Show>
                        <span>{item.label}</span>
                      </button>
                    )}
                  >
                    <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1 text-center">{item.label}</p>
                    <For each={item.submenu}>
                      {sub => (
                        <button
                          class="flex items-center gap-3 justify-center w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                          onClick={() => {
                            sub.onClick?.();
                            props.onClose();
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
        </div>
      </div>
    </div>
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
