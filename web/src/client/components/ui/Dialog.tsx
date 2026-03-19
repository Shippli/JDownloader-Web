import type { Component, JSX } from 'solid-js';
import { Dialog as KobalteDialog } from '@kobalte/core';
import { cn } from '../../lib/cn';
import { buttonVariants } from './Button';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
  maxWidth?: string;
};

export const Dialog: Component<DialogProps> = props => (
  <KobalteDialog.Root
    open={props.open}
    onOpenChange={(open) => {
      if (!open) {
        props.onClose();
      }
    }}
  >
    <KobalteDialog.Portal>
      <KobalteDialog.Overlay class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] !mt-0" />
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 !mt-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            props.onClose();
          }
        }}
      >
        <KobalteDialog.Content class={cn('bg-card rounded-xl shadow-xl w-full', props.maxWidth ?? 'max-w-md')}>
          <div class="flex items-center justify-between px-6 py-4 border-b">
            <KobalteDialog.Title class="text-base font-semibold text-foreground">
              {props.title}
            </KobalteDialog.Title>
            <KobalteDialog.CloseButton class={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
              <span class="i-tabler-x w-4 h-4" />
            </KobalteDialog.CloseButton>
          </div>
          {props.children}
        </KobalteDialog.Content>
      </div>
    </KobalteDialog.Portal>
  </KobalteDialog.Root>
);
