import type { DynamicProps } from '@corvu/drawer';
import type { ComponentProps, ValidComponent } from 'solid-js';
import DrawerPrimitive from '@corvu/drawer';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

export const Drawer = DrawerPrimitive;

function DrawerOverlay<T extends ValidComponent = 'div'>(props: DynamicProps<T, ComponentProps<typeof DrawerPrimitive.Overlay>>) {
  const [local, rest] = splitProps(props as ComponentProps<typeof DrawerPrimitive.Overlay>, ['class']);
  const ctx = DrawerPrimitive.useContext();
  return (
    <DrawerPrimitive.Overlay
      class={cx('fixed inset-0 z-40 bg-black/50 backdrop-blur-xs opacity-(--drawer-progress) data-[transitioning]:transition-opacity data-[transitioning]:duration-300', local.class)}
      style={{
        '--drawer-progress': ctx.openPercentage(),
      }}
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

// Menu list inside a drawer; context-menu styling with centered, touch-sized rows.
export const drawerListClass = 'flex flex-col p-2';

export function drawerItemClass(destructive?: boolean) {
  return cx(
    'flex items-center justify-center gap-2 w-full rounded-sm px-3 py-2.5 text-sm outline-none select-none transition-colors',
    destructive
      ? 'text-destructive hover:bg-destructive/10 active:bg-destructive/10 focus-visible:bg-destructive/10 dark:hover:bg-destructive/20 dark:active:bg-destructive/20'
      : 'text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent focus-visible:bg-accent',
  );
}

export const drawerSeparatorClass = 'bg-border -mx-2 my-1 h-px';

export const drawerGroupLabelClass = 'px-3 pt-2 pb-1 text-center text-xs font-medium text-muted-foreground';
