import type { Component } from 'solid-js';
import { createEffect, createSignal } from 'solid-js';
import { t } from '../../i18n';
import { Button } from './Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogPortal, DialogTitle } from './Dialog';
import { TextField } from './TextField';

type PromptDialogProps = {
  open: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  // Called with the trimmed value before onClose; empty input just closes.
  onSubmit: (value: string) => void;
  onClose: () => void;
};

export const PromptDialog: Component<PromptDialogProps> = (props) => {
  const [value, setValue] = createSignal('');
  createEffect(() => {
    if (props.open) {
      setValue(props.initialValue ?? '');
    }
  });
  const submit = () => {
    const v = value().trim();
    if (v) {
      props.onSubmit(v);
    }
    props.onClose();
  };
  return (
    <Dialog open={props.open} onOpenChange={open => !open && props.onClose()}>
      <DialogPortal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
          </DialogHeader>
          <TextField
            type="text"
            value={value()}
            onChange={setValue}
            placeholder={props.placeholder}
            inputProps={{
              'onKeyDown': (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              },
              'data-autofocus': '',
            }}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => props.onClose()}>{t('common.cancel')}</Button>
            <Button variant="default" onClick={submit}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
