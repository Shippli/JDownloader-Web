import type { Component, JSX } from 'solid-js';
import { t } from '../i18n';
import { Button } from './ui/Button';

type FormActionsProps = {
  saving: boolean;
  // Without onSave the save button submits the surrounding form.
  onSave?: () => void;
  onCancel: () => void;
  // Extra buttons between save and cancel.
  children?: JSX.Element;
};

// Save / cancel row of an inline edit form.
export const FormActions: Component<FormActionsProps> = props => (
  <div class="flex items-center gap-2 flex-wrap justify-end">
    <Button
      type={props.onSave ? 'button' : 'submit'}
      variant="default"
      onClick={() => props.onSave?.()}
      loading={props.saving}
      icon="i-tabler-check"
    >
      {t('common.save')}
    </Button>
    {props.children}
    <Button type="button" variant="secondary" onClick={() => props.onCancel()}>{t('common.cancel')}</Button>
  </div>
);
