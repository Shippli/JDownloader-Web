import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { t } from '../../i18n';
import { configApi } from '../../lib/api';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const UpdateModal: Component<{ open: boolean; onClose: () => void }> = (props) => {
  const [restarting, setRestarting] = createSignal(false);

  const restartAndUpdate = async () => {
    setRestarting(true);
    try {
      await configApi.restartAndUpdate();
    } catch { /* ignore */ }
    setRestarting(false);
    props.onClose();
  };

  return (
    <ConfirmDialog
      open={props.open}
      onClose={props.onClose}
      title={t('dialogs.updateModalTitle')}
      message={t('dialogs.updateModalDesc')}
      icon="i-tabler-refresh-alert"
      confirmLabel={t('config.system.restartAndUpdate')}
      confirmVariant="default"
      confirmIcon="i-tabler-refresh-dot"
      loading={restarting()}
      onConfirm={restartAndUpdate}
    />
  );
};
