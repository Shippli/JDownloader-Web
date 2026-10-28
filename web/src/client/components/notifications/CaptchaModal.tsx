import type { Component } from 'solid-js';
import type { JdCaptchaDetail } from '../../lib/api';
import { createSignal, Show } from 'solid-js';
import { t } from '../../i18n';
import { captchaApi } from '../../lib/api';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { TextField } from '../ui/TextField';

export const CaptchaModal: Component<{ captcha: JdCaptchaDetail; onClose: () => void }> = (props) => {
  const [captchaSolution, setCaptchaSolution] = createSignal('');

  // An empty solution skips the captcha.
  const solve = async (solution: string) => {
    try {
      await captchaApi.solve(props.captcha.id, solution);
    } catch { /* ignore */ }
    props.onClose();
  };
  const submitCaptcha = () => solve(captchaSolution());
  const skipCaptcha = () => solve('');

  const title = () =>
    props.captcha.hoster
      ? `${t('captcha.label')} — ${props.captcha.hoster}`
      : t('captcha.label');

  const imgSrc = () => props.captcha.imageData ? `data:${props.captcha.imageData}` : null;

  return (
    <Dialog open={true} onClose={props.onClose} title={title()}>
      <div class="px-6 py-4 space-y-4">
        <Show when={imgSrc()}>
          {src => (
            <img
              src={src()}
              alt="captcha"
              class="max-w-full rounded border mx-auto block pixelated"
            />
          )}
        </Show>
        <Show when={props.captcha.explain}>
          <p class="text-sm text-muted-foreground">{props.captcha.explain}</p>
        </Show>
        <TextField
          type="text"
          value={captchaSolution()}
          onChange={setCaptchaSolution}
          placeholder={t('captcha.solutionPlaceholder')}
          inputProps={{
            'data-autofocus': '',
            'onKeyDown': (e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                submitCaptcha();
              }
            },
          }}
        />
      </div>
      <div class="px-6 py-4 border-t flex gap-2 justify-end">
        <Button variant="secondary" onClick={skipCaptcha}>
          {t('captcha.skip')}
        </Button>
        <Button variant="default" onClick={submitCaptcha} disabled={captchaSolution().trim() === ''}>
          {t('captcha.submit')}
        </Button>
      </div>
    </Dialog>
  );
};
