import type { DynamicProps } from '@corvu/drawer';
import type { ComponentProps, ValidComponent } from 'solid-js';
import DrawerPrimitive from '@corvu/drawer';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

export const Drawer = DrawerPrimitive;
export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;

export function DrawerOverlay<T extends ValidComponent = 'div'>(props: DynamicProps<T, ComponentProps<typeof DrawerPrimitive.Overlay>>) {
  const [local, rest] = splitProps(props as ComponentProps<typeof DrawerPrimitive.Overlay>, ['class']);
  const ctx = DrawerPrimitive.useContext();
  return (
    <DrawerPrimitive.Overlay
      class={cx('fixed inset-0 z-40 bg-black/50 backdrop-blur-xs opacity-(--drawer-progress) data-[transitioning]:transition-opacity data-[transitioning]:duration-300', local.class)}
      style={{ '--drawer-progress': ctx.openPercentage() }}
      {...rest}
    />
  );
}

export function DrawerContent<T extends ValidComponent = 'div'>(props: DynamicProps<T, ComponentProps<typeof DrawerPrimitive.Content>>) {
  const [local, rest] = splitProps(props as ComponentProps<typeof DrawerPrimitive.Content>, ['class', 'children']);
  return (
    <DrawerPrimitive.Portal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        class={cx(
          'fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-2xl pb-15.25 md:pb-0 max-h-[80vh] flex-col rounded-t-xl border border-b-0 bg-card text-card-foreground after:absolute after:inset-x-0 after:top-full after:-mt-px after:h-1/2 after:bg-inherit data-[transitioning]:transition-transform data-[transitioning]:duration-300 md:select-none',
          local.class,
        )}
        {...rest}
      >
        <div class="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
        {local.children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

export function DrawerLabel(props: ComponentProps<typeof DrawerPrimitive.Label>) {
  const [local, rest] = splitProps(props, ['class']);
  return <DrawerPrimitive.Label class={cx('text-sm font-semibold text-foreground', local.class)} {...rest} />;
}
