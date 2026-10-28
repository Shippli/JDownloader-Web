import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { t } from '../../i18n';
import { configApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

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
    <Dialog open={props.open} onClose={props.onClose} title={t('dialogs.updateModalTitle')}>
      <div class="px-6 py-4 space-y-4">
        <div class="flex items-start gap-3">
          <span class="i-tabler-refresh-alert w-6 h-6 text-primary shrink-0 mt-0.5" />
          <p class="text-sm text-foreground">{t('dialogs.updateModalDesc')}</p>
        </div>
        <div class="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => props.onClose()}>
            {t('common.cancel')}
          </Button>
          <Button variant="default" onClick={restartAndUpdate} loading={restarting()} icon="i-tabler-refresh-dot">
            {t('config.system.restartAndUpdate')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
