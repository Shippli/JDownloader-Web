import type { ComponentProps, ValidComponent } from 'solid-js';
import { DropdownMenu as DropdownMenuPrimitive } from '@kobalte/core/dropdown-menu';
import { usePopperContext } from '@kobalte/core/popper';
import { mergeProps, splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export type DropdownMenuProps = ComponentProps<typeof DropdownMenuPrimitive>;

export function DropdownMenu(props: DropdownMenuProps) {
  const merge = mergeProps<DropdownMenuProps[]>(
    {
      gutter: 4,
    },
    props,
  );

  return <DropdownMenuPrimitive data-slot="dropdown-menu" {...merge} />;
}

export type DropdownMenuTriggerProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof DropdownMenuPrimitive.Trigger<T>>;

export function DropdownMenuTrigger<T extends ValidComponent = 'div'>(props: DropdownMenuTriggerProps<T>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

export type DropdownMenuGroupProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof DropdownMenuPrimitive.Group<T>>;

export function DropdownMenuGroup<T extends ValidComponent = 'div'>(props: DropdownMenuGroupProps<T>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

export type DropdownMenuContentProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof DropdownMenuPrimitive.Content<T>>;

export function DropdownMenuContent<T extends ValidComponent = 'div'>(props: DropdownMenuContentProps<T>) {
  const [, rest] = splitProps(props as DropdownMenuContentProps, ['class']);

  const context = usePopperContext();

  return (
    <DropdownMenuPrimitive.Content
      data-slot="dropdown-menu-content"
      class={cx(
        'bg-popover text-popover-foreground origin-(--kb-menu-content-transform-origin) z-50 min-w-32 overflow-y-auto overflow-x-hidden rounded-md border p-1 shadow-md outline-none',
        'data-[expanded]:animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95',
        'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
        context.currentPlacement().includes('top') && 'slide-in-from-bottom-2',
        context.currentPlacement().includes('bottom') && 'slide-in-from-top-2',
        context.currentPlacement().includes('left') && 'slide-in-from-right-2',
        context.currentPlacement().includes('right') && 'slide-in-from-left-2',
        props.class,
      )}
      {...rest}
    />
  );
}

export type DropdownMenuItemProps<T extends ValidComponent = 'div'>
  = ComponentProps<typeof DropdownMenuPrimitive.Item<T>> & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  };

export function DropdownMenuItem<T extends ValidComponent = 'div'>(props: DropdownMenuItemProps<T>) {
  const [, rest] = splitProps(props as DropdownMenuItemProps, [
    'class',
    'inset',
    'variant',
  ]);

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={props.inset}
      data-variant={props.variant}
      class={cx(
        '[&>*:is(svg)]:data-[variant=destructive]:!text-destructive outline-hidden relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[inset]:pl-8 [&_svg:not([class*=size-])]:size-4 [&_svg:not([class*=text-])]:text-muted-foreground',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[variant=destructive]:data-[highlighted]:bg-destructive/10 dark:data-[variant=destructive]:data-[highlighted]:bg-destructive/20 data-[variant=destructive]:data-[highlighted]:text-destructive',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        props.class,
      )}
      {...rest}
    />
  );
}

export type DropdownMenuGroupLabelProps<T extends ValidComponent = 'span'>
  = ComponentProps<typeof DropdownMenuPrimitive.GroupLabel<T>> & {
    inset?: boolean;
  };

export function DropdownMenuGroupLabel<T extends ValidComponent = 'span'>(props: DropdownMenuGroupLabelProps<T>) {
  const [, rest] = splitProps(props as DropdownMenuGroupLabelProps, [
    'class',
    'inset',
  ]);

  return (
    <DropdownMenuPrimitive.GroupLabel
      as="div"
      data-slot="dropdown-menu-group-label"
      data-inset={props.inset}
      class={cx(
        'text-foreground my-1.5 px-2 text-sm font-medium data-[inset]:pl-8',
        props.class,
      )}
      {...rest}
    />
  );
}

export type DropdownMenuSeparatorProps<T extends ValidComponent = 'hr'>
  = ComponentProps<typeof DropdownMenuPrimitive.Separator<T>>;

export function DropdownMenuSeparator<T extends ValidComponent = 'hr'>(props: DropdownMenuSeparatorProps<T>) {
  const [, rest] = splitProps(props as DropdownMenuSeparatorProps, ['class']);

  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      class={cx('bg-border -mx-1 my-1 h-px border-none', props.class)}
      {...rest}
    />
  );
}
