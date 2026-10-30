import type { ComponentProps, ValidComponent } from 'solid-js';
import { ContextMenu as ContextMenuPrimitive } from '@kobalte/core/context-menu';
import { usePopperContext } from '@kobalte/core/popper';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

export const ContextMenuPortal = ContextMenuPrimitive.Portal;

export type ContextMenuProps = ComponentProps<typeof ContextMenuPrimitive>;

export function ContextMenu(props: ContextMenuProps) {
  return <ContextMenuPrimitive data-slot="context-menu" {...props} />;
}

export type ContextMenuTriggerProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof ContextMenuPrimitive.Trigger<T>>;

export function ContextMenuTrigger<T extends ValidComponent = 'div'>(props: ContextMenuTriggerProps<T>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  );
}

export type ContextMenuSubProps = ComponentProps<
  typeof ContextMenuPrimitive.Sub
>;

export function ContextMenuSub(props: ContextMenuSubProps) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

export type ContextMenuSubTriggerProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof ContextMenuPrimitive.SubTrigger<T>> & {
    inset?: boolean;
  };

export function ContextMenuSubTrigger<T extends ValidComponent = 'div'>(props: ContextMenuSubTriggerProps<T>) {
  const [, rest] = splitProps(props as ContextMenuSubTriggerProps, [
    'class',
    'children',
    'inset',
  ]);

  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={props.inset}
      class={cx(
        'outline-hidden flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[inset]:pl-8 [&_svg:not([class*=size-])]:size-4',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[expanded]:bg-accent data-[expanded]:text-accent-foreground',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        props.class,
      )}
      {...rest}
    >
      {props.children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="ml-auto"
        viewBox="0 0 24 24"
      >
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="m9 18l6-6l-6-6"
        />
      </svg>
    </ContextMenuPrimitive.SubTrigger>
  );
}

function contentClass(placement: string) {
  return cx(
    'bg-popover text-popover-foreground origin-(--kb-menu-content-transform-origin) z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-lg outline-none',
    'data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95',
    'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
    placement.includes('top') && 'slide-in-from-bottom-2',
    placement.includes('bottom') && 'slide-in-from-top-2',
    placement.includes('left') && 'slide-in-from-right-2',
    placement.includes('right') && 'slide-in-from-left-2',
  );
}

export type ContextMenuSubContentProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof ContextMenuPrimitive.SubContent<T>>;

export function ContextMenuSubContent<T extends ValidComponent = 'div'>(props: ContextMenuSubContentProps<T>) {
  const [, rest] = splitProps(props as ContextMenuSubContentProps, ['class']);

  const context = usePopperContext();

  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      class={cx(contentClass(context.currentPlacement()), props.class)}
      {...rest}
    />
  );
}

export type ContextMenuContentProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof ContextMenuPrimitive.Content<T>>;

export function ContextMenuContent<T extends ValidComponent = 'div'>(props: ContextMenuContentProps<T>) {
  const [, rest] = splitProps(props as ContextMenuContentProps, ['class']);

  const context = usePopperContext();

  return (
    <ContextMenuPrimitive.Content
      data-slot="context-menu-content"
      class={cx(contentClass(context.currentPlacement()), props.class)}
      {...rest}
    />
  );
}

export type ContextMenuItemProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof ContextMenuPrimitive.Item<T>> & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  };

export function ContextMenuItem<T extends ValidComponent = 'div'>(props: ContextMenuItemProps<T>) {
  const [, rest] = splitProps(props as ContextMenuItemProps, [
    'class',
    'inset',
    'variant',
  ]);

  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={props.inset}
      data-variant={props.variant}
      class={cx(
        '[&>*:is(svg)]:data-[variant=destructive]:!text-destructive [&_svg:not([class*=text-])]:text-muted-foreground outline-hidden relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[inset]:pl-8 [&_svg:not([class*=size-])]:size-4',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 data-[variant=destructive]:data-[highlighted]:text-destructive dark:data-[variant=destructive]:data-[highlighted]:bg-destructive/20',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )}
      {...rest}
    />
  );
}

export type ContextMenuSeparatorProps<T extends ValidComponent = 'hr'>
  = ComponentProps<typeof ContextMenuPrimitive.Separator<T>>;

export function ContextMenuSeparator<T extends ValidComponent = 'hr'>(props: ContextMenuSeparatorProps<T>) {
  const [, rest] = splitProps(props as ContextMenuSeparatorProps, ['class']);

  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      class={cx('bg-border -mx-1 my-1 h-px border-none', props.class)}
      {...rest}
    />
  );
}
