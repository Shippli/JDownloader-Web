import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { t } from '../../i18n';
import { Button } from './Button';
import { Dialog, DialogBody, DialogFooter } from './Dialog';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  // Icon class shown left of the message.
  icon?: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'default';
  confirmIcon?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  // Extra content below the message (e.g. an option checkbox).
  children?: JSX.Element;
};

export const ConfirmDialog: Component<ConfirmDialogProps> = props => (
  <Dialog open={props.open} onClose={props.onClose} title={props.title}>
    <DialogBody>
      <div class="flex items-start gap-3">
        <Show when={props.icon}>
          <span class={`${props.icon} w-6 h-6 text-primary shrink-0 mt-0.5`} />
        </Show>
        <p class="text-sm text-foreground">{props.message}</p>
      </div>
      {props.children}
      <DialogFooter>
        <Button variant="secondary" onClick={() => props.onClose()}>{t('common.cancel')}</Button>
        <Button variant={props.confirmVariant ?? 'danger'} onClick={() => props.onConfirm()} loading={props.loading} icon={props.confirmIcon}>
          {props.confirmLabel}
        </Button>
      </DialogFooter>
    </DialogBody>
  </Dialog>
);
