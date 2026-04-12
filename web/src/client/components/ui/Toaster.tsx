import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from '../../lib/cn';
import { buttonVariants } from './Button';

export type ToastType = 'default' | 'info' | 'success' | 'warning' | 'error';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  visible: boolean;
  onClick?: () => void;
};

let nextId = 0;
const [toasts, setToasts] = createSignal<ToastItem[]>([]);

function add(message: string, type: ToastType = 'default', duration = 5000, onClick?: () => void) {
  const id = nextId++;
  setToasts(prev => [...prev, { id, message, type, duration, visible: true, onClick }]);

  setTimeout(dismiss, duration, id);
}

function dismiss(id: number) {
  setToasts(prev =>
    prev.map(t => (t.id === id ? { ...t, visible: false } : t)),
  );
  // Remove from DOM after fade-out
  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, 300);
}

type ToastOpts = { duration?: number; onClick?: () => void };

export const toast = Object.assign(
  (message: string, opts?: ToastOpts) => add(message, 'default', opts?.duration, opts?.onClick),
  {
    info: (message: string, opts?: ToastOpts) => add(message, 'info', opts?.duration, opts?.onClick),
    success: (message: string, opts?: ToastOpts) => add(message, 'success', opts?.duration, opts?.onClick),
    warning: (message: string, opts?: ToastOpts) => add(message, 'warning', opts?.duration, opts?.onClick),
    error: (message: string, opts?: ToastOpts) => add(message, 'error', opts?.duration, opts?.onClick),
  },
);

const iconClass: Record<ToastType, string> = {
  default: 'i-tabler-bell-filled w-5 h-5',
  info: 'i-tabler-info-circle-filled w-5 h-5 text-foreground',
  success: 'i-tabler-circle-check-filled w-5 h-5 text-green-500',
  warning: 'i-tabler-alert-triangle-filled w-5 h-5 text-yellow-500',
  error: 'i-tabler-circle-x-filled w-5 h-5 text-red-500',
};

const ToastItemView: Component<{ toast: ToastItem }> = (props) => {
  const hasClick = () => !!props.toast.onClick;
  return (
    <div
      class={cn(
        'flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-border bg-card text-foreground shadow-xl text-base transition-all duration-300',
        props.toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none',
      )}
    >
      <button
        onClick={() => {
          if (props.toast.onClick) {
            props.toast.onClick();
            dismiss(props.toast.id);
          }
        }}
        disabled={!hasClick()}
        class={cn(
          'flex items-center gap-3 flex-1 min-w-0 text-left',
          hasClick() ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default',
        )}
        aria-label={hasClick() ? props.toast.message : undefined}
      >
        <span class={cn(iconClass[props.toast.type], 'shrink-0')} />
        <span class="flex-1 min-w-0 font-medium truncate">{props.toast.message}</span>
      </button>
      <button
        onClick={() => dismiss(props.toast.id)}
        class={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'shrink-0')}
        aria-label="Dismiss"
      >
        <span class="i-tabler-x w-5 h-5" />
      </button>
    </div>
  );
};

export const Toaster: Component = () => {
  return (
    <Portal>
      <div class="fixed top-4 left-0 right-0 px-4 z-[300] flex flex-col items-center gap-2 pointer-events-none md:top-auto md:bottom-4 md:left-auto md:right-4 md:px-0 md:w-96 md:items-stretch">
        <For each={toasts()}>
          {t => (
            <div class="pointer-events-auto w-full">
              <ToastItemView toast={t} />
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
};
