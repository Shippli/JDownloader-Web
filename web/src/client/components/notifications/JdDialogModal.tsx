import type { Component } from 'solid-js';
import type { JdDialogDetail } from '../../lib/api';
import { createSignal, Show } from 'solid-js';
import { t } from '../../i18n';
import { dialogsApi } from '../../lib/api';
import { dialogTitle, suppressPackageDialogToasts } from '../../stores/notifications';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogPortal, DialogTitle } from '../ui/Dialog';
import { RadioGroup } from '../ui/RadioGroup';
import { TextField } from '../ui/TextField';

type FileExistsAction = 'SKIP' | 'AUTO_RENAME' | 'OVERWRITE';

// Generic JD dialog, with dedicated forms for "file exists" and "archive password".
export const JdDialogModal: Component<{ dialog: JdDialogDetail; onClose: () => void }> = (props) => {
  const [archivePassword, setArchivePassword] = createSignal('');
  const [fileExistsAction, setFileExistsAction] = createSignal<FileExistsAction>('SKIP');
  const [fileExistsApplyAll, setFileExistsApplyAll] = createSignal(false);

  const answerDialog = async (closereason: 'OK' | 'CANCEL', extra?: Record<string, unknown>) => {
    try {
      await dialogsApi.answer(props.dialog.id, { closereason, ...extra });
    } catch { /* ignore */ }
    props.onClose();
  };

  const p = () => props.dialog.properties ?? {};
  const msg = () => p().message ?? '';
  const okText = () => p().okbuttontext || 'OK';
  const cancelText = () => p().cancelbuttontext || 'Cancel';
  const isFileExists = () => props.dialog.type?.includes('IfFileExists') ?? false;
  const isExtractPassword = () => props.dialog.type?.includes('ExtractPasswordDialog') ?? false;

  return (
    <Dialog open={true} onOpenChange={open => !open && props.onClose()}>
      <DialogPortal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle(props.dialog)}</DialogTitle>
          </DialogHeader>
          <div class="max-h-[55vh] overflow-y-auto space-y-4">
            <Show when={props.dialog.icon}>
              <img
                src={`data:image/png;base64,${props.dialog.icon}`}
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
                    {
                      value: 'SKIP',
                      label: t('dialogs.actionSkip'),
                    },
                    {
                      value: 'AUTO_RENAME',
                      label: t('dialogs.actionAutoRename'),
                    },
                    {
                      value: 'OVERWRITE',
                      label: t('dialogs.actionOverwrite'),
                    },
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
                    'data-autofocus': '',
                    'onKeyDown': (e: KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        answerDialog('OK', {
                          text: archivePassword(),
                        });
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
          <DialogFooter>
            <Button variant="secondary" onClick={() => answerDialog('CANCEL')}>
              {cancelText()}
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (isExtractPassword()) {
                  answerDialog('OK', {
                    text: archivePassword(),
                  });
                  return;
                }
                if (isFileExists()) {
                  const packageid = p().packageid as string | undefined;
                  if (fileExistsApplyAll() && packageid) {
                    suppressPackageDialogToasts(packageid);
                  }
                  answerDialog('OK', {
                    action: fileExistsAction(),
                    ...(fileExistsApplyAll() && packageid
                      ? { packageid }
                      : {}),
                  });
                  return;
                }
                answerDialog('OK');
              }}
              disabled={isExtractPassword() && archivePassword().trim() === ''}
            >
              {okText()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
