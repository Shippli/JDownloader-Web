import type { Component } from 'solid-js';
import type { JdCaptchaDetail, JdDialog, JdDialogDetail } from '../lib/api';
import { createEffect, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '../i18n';
import { captchaApi, configApi, dialogsApi } from '../lib/api';
import { activePopupStore } from '../stores/activePopup';
import { notificationsStore } from '../stores/notifications';
import { sendRefresh } from '../stores/ws';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { Dialog } from './ui/Dialog';
import { RadioGroup } from './ui/RadioGroup';
import { TextField } from './ui/TextField';

type Props = {
  collapsed?: boolean;
  mobile?: boolean;
};

type CaptchaEntry = { kind: 'captcha'; id: number; hoster?: string };

// ─── Modals (rendered once in AppShell) ───────────────────────────────────────

export const NotificationModals: Component = () => {
  const [showUpdateModal, setShowUpdateModal] = createSignal(false);
  const [restarting, setRestarting] = createSignal(false);
  const [selectedDialog, setSelectedDialog] = createSignal<JdDialogDetail | null>(null);
  const [selectedCaptcha, setSelectedCaptcha] = createSignal<JdCaptchaDetail | null>(null);
  const [captchaSolution, setCaptchaSolution] = createSignal('');
  const [archivePassword, setArchivePassword] = createSignal('');
  const [fileExistsAction, setFileExistsAction] = createSignal<'SKIP' | 'AUTO_RENAME' | 'OVERWRITE'>('SKIP');
  const [fileExistsApplyAll, setFileExistsApplyAll] = createSignal(false);

  const openDetail = async (dialog: JdDialog) => {
    try {
      const detail = await dialogsApi.get(dialog.id);
      setSelectedDialog(detail ?? { ...dialog });
    } catch {
      setSelectedDialog({ ...dialog });
    }
  };

  const openCaptcha = async (entry: CaptchaEntry) => {
    setCaptchaSolution('');
    try {
      const detail = await captchaApi.get(entry.id);
      setSelectedCaptcha(detail);
    } catch {
      setSelectedCaptcha({ id: entry.id, hoster: entry.hoster });
    }
  };

  // React to pendingOpen (set by toast click or panel list click)
  createEffect(() => {
    const p = notificationsStore.pendingOpen();
    if (!p) {
      return;
    }
    notificationsStore.clearPendingOpen();
    if (p.kind === 'dialog') {
      openDetail(p.dialog);
    } else if (p.kind === 'captcha') {
      openCaptcha(p.entry);
    } else if (p.kind === 'update') {
      setShowUpdateModal(true);
    }
  });

  const closeModal = () => {
    setSelectedDialog(null);
    setArchivePassword('');
    setFileExistsAction('SKIP');
    setFileExistsApplyAll(false);
  };
  const closeCaptchaModal = () => {
    setSelectedCaptcha(null);
    setCaptchaSolution('');
  };

  const answerDialog = async (closereason: 'OK' | 'CANCEL', extra?: Record<string, unknown>) => {
    const d = selectedDialog();
    if (!d) {
      return;
    }
    try {
      await dialogsApi.answer(d.id, { closereason, ...extra });
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

  const restartAndUpdate = async () => {
    setRestarting(true);
    try {
      await configApi.restartAndUpdate();
    } catch { /* ignore */ }
    setRestarting(false);
    setShowUpdateModal(false);
  };

  const dialogTitle = (d: JdDialog) =>
    d.properties?.title || d.type?.split('.').pop() || String(d.id);

  return (
    <>
      {/* Dialog Detail Modal */}
      <Show when={selectedDialog()}>
        {(dialog) => {
          const p = () => dialog().properties ?? {};
          const msg = () => p().message ?? '';
          const okText = () => p().okbuttontext || 'OK';
          const cancelText = () => p().cancelbuttontext || 'Cancel';
          const isFileExists = () => dialog().type?.includes('IfFileExists') ?? false;
          const isExtractPassword = () => dialog().type?.includes('ExtractPasswordDialog') ?? false;

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
                      <RadioGroup
                        class="pt-1"
                        value={fileExistsAction()}
                        onChange={v => setFileExistsAction(v as 'SKIP' | 'AUTO_RENAME' | 'OVERWRITE')}
                        options={[
                          { value: 'SKIP', label: t('dialogs.actionSkip') },
                          { value: 'AUTO_RENAME', label: t('dialogs.actionAutoRename') },
                          { value: 'OVERWRITE', label: t('dialogs.actionOverwrite') },
                        ]}
                      />
                      <div class="border-t pt-3 mt-1">
                        <Checkbox
                          checked={fileExistsApplyAll()}
                          onChange={setFileExistsApplyAll}
                          label={t('dialogs.applyToPackage')}
                        />
                      </div>
                    </div>
                  </Show>
                  <Show when={isExtractPassword()}>
                    <div class="space-y-3">
                      <Show when={p().archivename as string | undefined}>
                        {name => (
                          <div>
                            <p class="text-xs font-medium text-muted-foreground mb-1">{t('dialogs.archiveName')}</p>
                            <p class="text-sm text-foreground font-mono bg-muted rounded px-2 py-1.5 break-all">{name()}</p>
                          </div>
                        )}
                      </Show>
                      <Show when={msg()}>
                        <p class="text-sm text-foreground">{msg()}</p>
                      </Show>
                      <TextField
                        type="text"
                        value={archivePassword()}
                        onChange={setArchivePassword}
                        placeholder={t('dialogs.passwordPlaceholder')}
                        inputProps={{
                          autofocus: true,
                          onKeyDown: (e: KeyboardEvent) => {
                            if (e.key === 'Enter') {
                              answerDialog('OK', { text: archivePassword() });
                            }
                          },
                        }}
                      />
                    </div>
                  </Show>
                  <Show when={!isExtractPassword() && msg()}>
                    <p class="text-sm text-foreground whitespace-pre-wrap">{msg()}</p>
                  </Show>
                </div>
                <div class="px-6 py-4 border-t flex gap-2 justify-end">
                  <Button variant="secondary" onClick={() => answerDialog('CANCEL')}>
                    {cancelText()}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => isExtractPassword()
                      ? answerDialog('OK', { text: archivePassword() })
                      : isFileExists()
                        ? answerDialog('OK', { action: fileExistsAction(), ...(fileExistsApplyAll() && { applytoall: true }) })
                        : answerDialog('OK')}
                    disabled={isExtractPassword() && archivePassword().trim() === ''}
                  >
                    {okText()}
                  </Button>
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

// ─── Panel (popup list in sidebar / mobile nav) ───────────────────────────────

export const NotificationsPanel: Component<Props> = (props) => {
  const PANEL_ID = untrack(() => props.mobile) ? 'notifications-panel-mobile' : 'notifications-panel-desktop';
  const dialogs = notificationsStore.dialogs;
  const captchas = notificationsStore.captchas;
  const updateAvailable = notificationsStore.updateAvailable;
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

  const count = () => dialogs().length + captchas().length + (updateAvailable() ? 1 : 0);

  const toggleDesktop = () => {
    if (!isOpen() && buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      const width = props.collapsed ? 240 : rect.width;
      setPopupPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width });
      activePopupStore.open(PANEL_ID);
    } else {
      activePopupStore.closeAll();
    }
  };

  const dialogTitle = (d: JdDialog) =>
    d.properties?.title || d.type?.split('.').pop() || String(d.id);

  const openItem = (item: { kind: 'dialog'; dialog: JdDialog } | { kind: 'captcha'; entry: CaptchaEntry } | { kind: 'update' }) => {
    activePopupStore.closeAll();
    notificationsStore.openNotification(item);
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
              onClick={() => openItem({ kind: 'update' })}
              class={`flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors ${props.mobile ? 'justify-center' : ''}`}
            >
              <span class="i-tabler-refresh-alert w-4 h-4 shrink-0 text-primary" />
              <p class="text-sm font-medium text-foreground truncate">{t('dialogs.updateEntry')}</p>
            </button>
          </Show>
          <For each={captchas()}>
            {entry => (
              <button
                onClick={() => openItem({ kind: 'captcha', entry })}
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
                onClick={() => openItem({ kind: 'dialog', dialog })}
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
    </>
  );
};
