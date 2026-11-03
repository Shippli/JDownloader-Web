import type { ComponentProps, ValidComponent } from 'solid-js';
import { Dialog as DialogPrimitive } from '@kobalte/core/dialog';
import { mergeProps, Show, splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

export const DialogPortal = DialogPrimitive.Portal;

export type DialogProps = ComponentProps<typeof DialogPrimitive>;

export function Dialog(props: DialogProps) {
  return <DialogPrimitive data-slot="dialog" {...props} />;
}

export type DialogTriggerProps<T extends ValidComponent = 'button'>
  = ComponentProps<typeof DialogPrimitive.Trigger<T>>;

export function DialogTrigger<T extends ValidComponent = 'button'>(props: DialogTriggerProps<T>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export type DialogCloseButtonProps<T extends ValidComponent = 'button'>
  = ComponentProps<typeof DialogPrimitive.CloseButton<T>>;

export function DialogCloseButton<T extends ValidComponent = 'button'>(props: DialogCloseButtonProps<T>) {
  return <DialogPrimitive.CloseButton data-slot="dialog-close" {...props} />;
}

export type DialogContentProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof DialogPrimitive.Content<T>> & {
    showCloseButton?: boolean;
  };

export function DialogContent<T extends ValidComponent = 'div'>(props: DialogContentProps<T>) {
  const merge = mergeProps(
    {
      showCloseButton: true,
    } as DialogContentProps,
    props,
  );
  const [local, rest] = splitProps(merge as DialogContentProps, [
    'class',
    'children',
    'showCloseButton',
    'onOpenAutoFocus',
  ]);
  let content: HTMLElement | undefined;

  return (
    <>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        class="data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[closed]:animate-out data-[closed]:fade-out-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-xs"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        ref={(el: HTMLElement) => (content = el)}
        // Focuses the first [data-autofocus] element unless a custom handler is given.
        onOpenAutoFocus={(e: Event) => {
          if (typeof local.onOpenAutoFocus === 'function') {
            local.onOpenAutoFocus(e);
            return;
          }
          const el = content?.querySelector<HTMLElement>('[data-autofocus]');
          if (el) {
            e.preventDefault();
            el.focus();
          }
        }}
        class={cx(
          'bg-card text-card-foreground fixed left-1/2 top-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          'data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95',
          'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
          props.class,
        )}
        {...rest}
      >
        {props.children}
        <Show when={merge.showCloseButton}>
          <DialogPrimitive.CloseButton
            aria-label="Close"
            class="rounded-xs absolute right-4 top-4 opacity-70 transition-opacity duration-200 hover:opacity-100 [&_svg:not([class*=size-])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18 6L6 18M6 6l12 12"
              />
            </svg>
          </DialogPrimitive.CloseButton>
        </Show>
      </DialogPrimitive.Content>
    </>
  );
}

export type DialogHeaderProps = ComponentProps<'div'>;

export function DialogHeader(props: DialogHeaderProps) {
  const [, rest] = splitProps(props, ['class']);

  return (
    <div
      data-slot="dialog-header"
      class={cx('flex flex-col gap-2 text-center sm:text-left', props.class)}
      {...rest}
    />
  );
}

export type DialogFooterProps = ComponentProps<'div'>;

export function DialogFooter(props: DialogFooterProps) {
  const [, rest] = splitProps(props, ['class']);

  return (
    <div
      data-slot="dialog-footer"
      class={cx(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        props.class,
      )}
      {...rest}
    />
  );
}

export type DialogTitleProps<T extends ValidComponent = 'h2'> = ComponentProps<
  typeof DialogPrimitive.Title<T>
>;

export function DialogTitle<T extends ValidComponent = 'h2'>(props: DialogTitleProps<T>) {
  const [, rest] = splitProps(props as DialogTitleProps, ['class']);

  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      class={cx('text-lg font-semibold leading-none', props.class)}
      {...rest}
    />
  );
}

export type DialogDescriptionProps<T extends ValidComponent = 'p'>
  = ComponentProps<typeof DialogPrimitive.Description<T>>;

export function DialogDescription<T extends ValidComponent = 'p'>(props: DialogDescriptionProps<T>) {
  const [, rest] = splitProps(props as DialogDescriptionProps, ['class']);

  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      class={cx('text-muted-foreground text-sm', props.class)}
      {...rest}
    />
  );
}
