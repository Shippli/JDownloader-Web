import type { Component, JSX } from 'solid-js';
import { t } from '../../i18n';
import { Button } from './Button';
import { Dialog } from './Dialog';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  // Extra content below the message (e.g. an option checkbox).
  children?: JSX.Element;
};

export const ConfirmDialog: Component<ConfirmDialogProps> = props => (
  <Dialog open={props.open} onClose={props.onClose} title={props.title}>
    <div class="px-6 py-4 space-y-4">
      <p class="text-sm text-foreground">{props.message}</p>
      {props.children}
      <div class="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => props.onClose()}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={() => props.onConfirm()}>{props.confirmLabel}</Button>
      </div>
    </div>
  </Dialog>
);
