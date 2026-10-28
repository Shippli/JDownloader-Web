import type { Component } from 'solid-js';
import type { JdCaptchaDetail, JdDialogDetail } from '../../lib/api';
import { createEffect, createSignal, Show } from 'solid-js';
import { captchaApi, dialogsApi } from '../../lib/api';
import { notificationsStore } from '../../stores/notifications';
import { CaptchaModal } from './CaptchaModal';
import { JdDialogModal } from './JdDialogModal';
import { UpdateModal } from './UpdateModal';

// Rendered once in AppShell; opens whatever notificationsStore.pendingOpen requests
// (toast click or panel entry).
export const NotificationModals: Component = () => {
  const [dialog, setDialog] = createSignal<JdDialogDetail | null>(null);
  const [captcha, setCaptcha] = createSignal<JdCaptchaDetail | null>(null);
  const [showUpdate, setShowUpdate] = createSignal(false);

  createEffect(() => {
    const p = notificationsStore.pendingOpen();
    if (!p) {
      return;
    }
    notificationsStore.clearPendingOpen();
    if (p.kind === 'dialog') {
      dialogsApi.get(p.dialog.id)
        .then(detail => setDialog(detail ?? { ...p.dialog }))
        .catch(() => setDialog({ ...p.dialog }));
    } else if (p.kind === 'captcha') {
      captchaApi.get(p.entry.id)
        .then(setCaptcha)
        .catch(() => setCaptcha({ id: p.entry.id, hoster: p.entry.hoster }));
    } else {
      setShowUpdate(true);
    }
  });

  return (
    <>
      <Show when={dialog()} keyed>
        {d => <JdDialogModal dialog={d} onClose={() => setDialog(null)} />}
      </Show>
      <Show when={captcha()} keyed>
        {c => <CaptchaModal captcha={c} onClose={() => setCaptcha(null)} />}
      </Show>
      <UpdateModal open={showUpdate()} onClose={() => setShowUpdate(false)} />
    </>
  );
};
