import type { JdCaptcha, JdDialog } from '../lib/api';
import { createSignal } from 'solid-js';
import { toast } from '../components/ui/Toaster';
import { t } from '../i18n';

type CaptchaEntry = { kind: 'captcha'; id: number; hoster?: string };

const [dialogs, setDialogs] = createSignal<JdDialog[]>([]);
const [captchas, setCaptchas] = createSignal<CaptchaEntry[]>([]);
const [updateAvailable, setUpdateAvailable] = createSignal(false);

let knownDialogIds = new Set<number>();
let knownCaptchaIds = new Set<number>();
let updateToastShown = false;
let firstFetch = true;

export function applyNotificationsMessage(data: {
  dialogs: JdDialog[];
  captchas: JdCaptcha[];
  updateAvailable: boolean;
}) {
  // Dialogs
  const dialogList = data.dialogs;
  if (!firstFetch) {
    for (const d of dialogList) {
      if (!knownDialogIds.has(d.id)) {
        toast.info(d.properties?.title || d.type?.split('.').pop() || t('dialogs.title'), { duration: 5000 });
      }
    }
  }
  knownDialogIds = new Set(dialogList.map(d => d.id));
  setDialogs(dialogList);

  // Captchas
  const captchaList = (Array.isArray(data.captchas) ? data.captchas : []).map(c => ({
    kind: 'captcha' as const,
    id: c.id,
    hoster: c.hoster,
  }));
  if (!firstFetch) {
    for (const c of captchaList) {
      if (!knownCaptchaIds.has(c.id)) {
        toast.warning(`${t('captcha.label')}${c.hoster ? ` — ${c.hoster}` : ''}`, { duration: 5000 });
      }
    }
  }
  knownCaptchaIds = new Set(captchaList.map(c => c.id));
  setCaptchas(captchaList);

  // Update available
  const available = data.updateAvailable === true;
  if (available && !updateToastShown) {
    toast.info(t('dialogs.updateEntry'), { duration: 8000 });
    updateToastShown = true;
  }
  setUpdateAvailable(available);

  firstFetch = false;
}

export const notificationsStore = {
  dialogs,
  captchas,
  updateAvailable,
};
