import type { Component } from 'solid-js';
import type { JdCaptchaDetail, JdDialog, JdDialogDetail } from '../lib/api';
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '../i18n';
import { captchaApi, configApi, dialogsApi } from '../lib/api';
import { activePopupStore } from '../stores/activePopup';
import { notificationsStore } from '../stores/notifications';
import { sendRefresh } from '../stores/ws';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { TextField } from './ui/TextField';

type Props = {
  collapsed?: boolean;
  mobile?: boolean;
};

type CaptchaEntry = { kind: 'captcha'; id: number; hoster?: string };

export const NotificationsPanel: Component<Props> = (props) => {
  const PANEL_ID = props.mobile ? 'notifications-panel-mobile' : 'notifications-panel-desktop';
  const dialogs = notificationsStore.dialogs;
  const captchas = notificationsStore.captchas;
  const updateAvailable = notificationsStore.updateAvailable;
  const [showUpdateModal, setShowUpdateModal] = createSignal(false);
  const [restarting, setRestarting] = createSignal(false);
  const [selectedDialog, setSelectedDialog] = createSignal<JdDialogDetail | null>(null);
  const [selectedCaptcha, setSelectedCaptcha] = createSignal<JdCaptchaDetail | null>(null);
  const [captchaSolution, setCaptchaSolution] = createSignal('');
  const [timeLeft, setTimeLeft] = createSignal(0);
  const [popupPos, setPopupPos] = createSignal({ bottom: 0, left: 0, width: 240 });

  const isOpen = () => activePopupStore.active() === PANEL_ID;

  let buttonRef: HTMLButtonElement | undefined;
  let popupRef: HTMLDivElement | undefined;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      activePopupStore.close(PANEL_ID);
    }
  };

  onMount(() => {
    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => document.removeEventListener('keydown', onKeyDown));
  });

  // Close on any click outside the popup
  createEffect(() => {
    if (!isOpen()) {
      return;
    }
    let enabled = false;
    const timer = setTimeout(() => {
      enabled = true;
    }, 0);
    const onOutsideClick = (e: MouseEvent) => {
      if (!enabled) {
        return;
      }
      if (popupRef?.contains(e.target as Node)) {
        return;
      }
      activePopupStore.close(PANEL_ID);
    };
    document.addEventListener('click', onOutsideClick);
    onCleanup(() => {
      clearTimeout(timer);
      document.removeEventListener('click', onOutsideClick);
    });
  });

  // Countdown timer when a dialog with timeout is shown
  createEffect(() => {
    const d = selectedDialog();
    const ms = Number.parseInt(d?.properties?.timeout ?? '0');
    if (d && ms > 0) {
      setTimeLeft(Math.ceil(ms / 1000));
      const timer = setInterval(() => {
        setTimeLeft((s) => {
          if (s <= 1) {
            clearInterval(timer);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      onCleanup(() => clearInterval(timer));
    } else {
      setTimeLeft(0);
    }
  });

  const count = () => dialogs().length + captchas().length + (updateAvailable() ? 1 : 0);

  const restartAndUpdate = async () => {
    setRestarting(true);
    try {
      await configApi.restartAndUpdate();
    } catch { /* ignore */ }
    setRestarting(false);
    setShowUpdateModal(false);
  };

  const toggleDesktop = () => {
    if (!isOpen() && buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      setPopupPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
      activePopupStore.open(PANEL_ID);
    } else {
      activePopupStore.closeAll();
    }
  };

  const dialogTitle = (d: JdDialog) =>
    d.properties?.title || d.type?.split('.').pop() || String(d.id);

  const openDetail = async (dialog: JdDialog) => {
    activePopupStore.closeAll();
    try {
      const detail = await dialogsApi.get(dialog.id);
      setSelectedDialog(detail ?? { ...dialog });
    } catch {
      setSelectedDialog({ ...dialog });
    }
  };

  const openCaptcha = async (entry: CaptchaEntry) => {
    activePopupStore.closeAll();
    setCaptchaSolution('');
    try {
      const detail = await captchaApi.get(entry.id);
      setSelectedCaptcha(detail);
    } catch {
      setSelectedCaptcha({ id: entry.id, hoster: entry.hoster });
    }
  };

  const closeModal = () => setSelectedDialog(null);
  const closeCaptchaModal = () => {
    setSelectedCaptcha(null);
    setCaptchaSolution('');
  };

  const answerDialog = async (closereason: 'OK' | 'CANCEL') => {
    const d = selectedDialog();
    if (!d) {
      return;
    }
    try {
      await dialogsApi.answer(d.id, { closereason });
    } catch { /* ignore */ }
    closeModal();
    sendRefresh('notifications');
  };

  const submitCaptcha = async () => {
    const c = selectedCaptcha();
    if (!c) {
      return;
    }
    try {
      await captchaApi.solve(c.id, captchaSolution());
    } catch { /* ignore */ }
    closeCaptchaModal();
    sendRefresh('notifications');
  };

  const skipCaptcha = async () => {
    const c = selectedCaptcha();
    if (!c) {
      return;
    }
    try {
      await captchaApi.solve(c.id, '');
    } catch { /* ignore */ }
    closeCaptchaModal();
    sendRefresh('notifications');
  };

  const BellIcon = () => (
    <span class="relative flex items-center justify-center w-5 h-5 shrink-0">
      <span class="i-tabler-bell w-5 h-5" />
      <Show when={count() > 0}>
        <span class="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
          {count() > 9 ? '9+' : count()}
        </span>
      </Show>
    </span>
  );

  const isMobile = () => props.mobile;

  const PopupList = () => (
    <div class={`bg-card border overflow-hidden ${isMobile() ? 'rounded-t-xl border-b-0 shadow-[0_-8px_24px_rgba(0,0,0,0.1)]' : 'rounded-xl shadow-xl'}`}>
      <div class={`px-4 py-3 border-b ${isMobile() ? 'text-center' : ''}`}>
        <span class="font-semibold text-sm text-foreground">{t('dialogs.title')}</span>
      </div>
      <div class="max-h-72 overflow-y-auto">
        <Show
          when={count() > 0}
          fallback={(
            <p class="text-sm text-muted-foreground text-center py-6 px-4">
              {t('dialogs.empty')}
            </p>
          )}
        >
          <Show when={updateAvailable()}>
            <button
              onClick={() => {
                activePopupStore.closeAll();
                setShowUpdateModal(true);
              }}
              class={`flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors ${props.mobile ? 'justify-center' : ''}`}
            >
              <span class="i-tabler-refresh-alert w-4 h-4 shrink-0 text-primary" />
              <p class="text-sm font-medium text-foreground truncate">{t('dialogs.updateEntry')}</p>
            </button>
          </Show>
          <For each={captchas()}>
            {entry => (
              <button
                onClick={() => openCaptcha(entry)}
                class={`flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors ${props.mobile ? 'justify-center' : ''}`}
              >
                <span class="i-tabler-shield-lock w-4 h-4 shrink-0 text-orange-500" />
                <p class="text-sm font-medium text-foreground truncate">
                  {t('captcha.label')}
                  {entry.hoster ? ` — ${entry.hoster}` : ''}
                </p>
              </button>
            )}
          </For>
          <For each={dialogs()}>
            {dialog => (
              <button
                onClick={() => openDetail(dialog)}
                class={`flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors ${props.mobile ? 'justify-center' : ''}`}
              >
                <span class="i-tabler-info-circle w-4 h-4 shrink-0 text-blue-500" />
                <p class="text-sm font-medium text-foreground truncate">{dialogTitle(dialog)}</p>
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );

  return (
    <>
      <Show
        when={props.mobile}
        fallback={(
          /* Desktop sidebar button */
          <div>
            <button
              ref={buttonRef}
              onClick={toggleDesktop}
              class="flex items-center gap-3 w-full rounded-lg px-3 h-9 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title={props.collapsed ? t('nav.notifications') : undefined}
            >
              <BellIcon />
              <Show when={!props.collapsed}>
                <span class="whitespace-nowrap">{t('nav.notifications')}</span>
              </Show>
            </button>
            <Show when={isOpen()}>
              <Portal>
                <div
                  ref={popupRef}
                  class="fixed z-[210]"
                  style={{
                    bottom: `${popupPos().bottom}px`,
                    left: `${popupPos().left}px`,
                    width: `${popupPos().width}px`,
                  }}
                >
                  <PopupList />
                </div>
              </Portal>
            </Show>
          </div>
        )}
      >
        {/* Mobile bottom-nav button */}
        <div class="relative flex-1">
          <button
            onClick={() => {
              isOpen() ? activePopupStore.closeAll() : activePopupStore.open(PANEL_ID);
            }}
            ref={buttonRef}
            title={t('nav.notifications')}
            class="w-full flex items-center justify-center py-5 text-muted-foreground"
          >
            <BellIcon />
          </button>
          <Show when={isOpen()}>
            <div ref={popupRef} class="fixed bottom-[61px] left-0 right-0 z-[210]">
              <PopupList />
            </div>
          </Show>
        </div>
      </Show>

      {/* Dialog Detail Modal */}
      <Show when={selectedDialog()}>
        {(dialog) => {
          const p = () => dialog().properties ?? {};
          const msg = () => p().message ?? '';
          const okText = () => p().okbuttontext || 'OK';
          const cancelText = () => p().cancelbuttontext || 'Cancel';
          const isFileExists = () => dialog().type?.includes('IfFileExists') ?? false;

          return (
            <Portal>
              <Dialog open={true} onClose={closeModal} title={dialogTitle(dialog())}>
                <div class="px-6 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
                  <Show when={dialog().icon}>
                    <img
                      src={`data:image/png;base64,${dialog().icon}`}
                      alt="dialog icon"
                      class="max-w-full rounded border"
                    />
                  </Show>
                  <Show when={isFileExists()}>
                    <div class="space-y-3">
                      <Show when={p().filepath as string | undefined}>
                        {fp => (
                          <div>
                            <p class="text-xs font-medium text-muted-foreground mb-1">{t('dialogs.filepath')}</p>
                            <p class="text-sm text-foreground break-all font-mono bg-muted rounded px-2 py-1.5">{fp()}</p>
                          </div>
                        )}
                      </Show>
                      <div class="flex gap-4">
                        <Show when={p().packagename as string | undefined}>
                          {name => (
                            <div class="flex-1 min-w-0">
                              <p class="text-xs font-medium text-muted-foreground mb-1">{t('dialogs.package')}</p>
                              <p class="text-sm text-foreground truncate">{name()}</p>
                            </div>
                          )}
                        </Show>
                        <Show when={p().host as string | undefined}>
                          {host => (
                            <div class="shrink-0">
                              <p class="text-xs font-medium text-muted-foreground mb-1">{t('dialogs.host')}</p>
                              <p class="text-sm text-foreground">{host()}</p>
                            </div>
                          )}
                        </Show>
                      </div>
                    </div>
                  </Show>
                  <Show when={msg()}>
                    <p class="text-sm text-foreground whitespace-pre-wrap">{msg()}</p>
                  </Show>
                </div>
                <div class="px-6 py-4 border-t flex items-center gap-3">
                  <Show when={timeLeft() > 0}>
                    <span class="text-xs text-muted-foreground">
                      {t('dialogs.autoClose')}
                      {' '}
                      {timeLeft()}
                      s
                    </span>
                  </Show>
                  <div class="flex gap-2 ml-auto">
                    <Button variant="secondary" onClick={() => answerDialog('CANCEL')}>
                      {cancelText()}
                    </Button>
                    <Button variant="default" onClick={() => answerDialog('OK')}>
                      {okText()}
                    </Button>
                  </div>
                </div>
              </Dialog>
            </Portal>
          );
        }}
      </Show>

      {/* Captcha Modal */}
      <Show when={selectedCaptcha()}>
        {(captcha) => {
          const title = () =>
            captcha().hoster
              ? `${t('captcha.label')} — ${captcha().hoster}`
              : t('captcha.label');

          // Backend wraps JD's raw "image/jpeg;base64,..." string into imageData
          const imgSrc = () => captcha().imageData ? `data:${captcha().imageData}` : null;

          return (
            <Portal>
              <Dialog open={true} onClose={closeCaptchaModal} title={title()}>
                <div class="px-6 py-4 space-y-4">
                  <Show when={imgSrc()}>
                    {src => (
                      <img
                        src={src()}
                        alt="captcha"
                        class="max-w-full rounded border mx-auto block"
                        style={{ 'image-rendering': 'pixelated' }}
                      />
                    )}
                  </Show>
                  <Show when={captcha().explain}>
                    <p class="text-sm text-muted-foreground">{captcha().explain}</p>
                  </Show>
                  <TextField
                    type="text"
                    value={captchaSolution()}
                    onChange={setCaptchaSolution}
                    placeholder={t('captcha.solutionPlaceholder')}
                    inputProps={{
                      autofocus: true,
                      onKeyDown: (e: KeyboardEvent) => {
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
            </Portal>
          );
        }}
      </Show>
      {/* Update Modal */}
      <Show when={showUpdateModal()}>
        <Portal>
          <Dialog open={true} onClose={() => setShowUpdateModal(false)} title={t('dialogs.updateModalTitle')}>
            <div class="px-6 py-4 flex items-start gap-3">
              <span class="i-tabler-refresh-alert w-6 h-6 text-primary shrink-0 mt-0.5" />
              <p class="text-sm text-foreground">{t('dialogs.updateModalDesc')}</p>
            </div>
            <div class="px-6 py-4 border-t flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowUpdateModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="default" onClick={restartAndUpdate} disabled={restarting()}>
                <Show when={restarting()} fallback={<span class="i-tabler-refresh-dot w-4 h-4" />}>
                  <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
                </Show>
                {t('config.system.restartAndUpdate')}
              </Button>
            </div>
          </Dialog>
        </Portal>
      </Show>
    </>
  );
};
