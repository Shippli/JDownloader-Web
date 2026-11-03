import type { Component } from 'solid-js';
import type { Priority } from '../lib/priority';
import { For } from 'solid-js';
import { t } from '../i18n';
import { PRIORITIES } from '../lib/priority';
import { Dialog, DialogContent, DialogHeader, DialogPortal, DialogTitle } from './ui/Dialog';

export const PriorityDialog: Component<{ open: boolean; onClose: () => void; onSelect: (p: Priority) => void }> = props => (
  <Dialog open={props.open} onOpenChange={open => !open && props.onClose()}>
    <DialogPortal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('common.priority.label')}</DialogTitle>
        </DialogHeader>
        <div class="-mx-6">
          <For each={PRIORITIES}>
            {p => (
              <button
                class="flex items-center justify-center gap-3 w-full px-6 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                onClick={() => {
                  props.onSelect(p.key);
                  props.onClose();
                }}
              >
                <span class={`${p.icon} w-4 h-4 text-muted-foreground`} />
                {t(p.labelKey)}
              </button>
            )}
          </For>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
);
