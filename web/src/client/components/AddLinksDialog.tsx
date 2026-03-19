import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { t } from '../i18n';
import { jdApi } from '../lib/api';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from './ui/Tabs';
import { Textarea } from './ui/Textarea';
import { TextField } from './ui/TextField';

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

const AddLinksDialog: Component<Props> = (props) => {
  const [tab, setTab] = createSignal<'links' | 'dlc'>('links');
  const [links, setLinks] = createSignal('');
  const [packageName, setPackageName] = createSignal('');
  const [extractPass, setExtractPass] = createSignal('');
  const [dlcContent, setDlcContent] = createSignal('');
  const [autostart, setAutostart] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleAddLinks = async () => {
    if (!links().trim()) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      await jdApi.addLinks({
        links: links().trim(),
        packageName: packageName() || undefined,
        extractPassword: extractPass() || undefined,
        autostart: autostart(),
      });
      props.onAdded();
      props.onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDlc = async () => {
    if (!dlcContent().trim()) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      // DLC content can be pasted as base64 or file content
      const content = dlcContent().trim();
      await jdApi.addContainer('dlc', content);
      props.onAdded();
      props.onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      // Extract base64 if data URL, otherwise use raw
      const base64 = content.includes(',') ? content.split(',')[1] : content;
      setDlcContent(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={true} onClose={props.onClose} title={t('addLinks.title')} maxWidth="max-w-lg">
      <TabsRoot value={tab()} onChange={setTab}>
        <TabsList class="px-6 pt-4">
          <TabsTrigger value="links">
            <span class="i-tabler-link w-4 h-4" />
            {t('addLinks.tabLinks')}
          </TabsTrigger>
          <TabsTrigger value="dlc">
            <span class="i-tabler-file-zip w-4 h-4" />
            {t('addLinks.tabDlc')}
          </TabsTrigger>
        </TabsList>

        {/* Content */}
        <div class="p-5 pt-4 flex flex-col gap-4">
          <TabsContent value="links">
            <div class="flex flex-col gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addLinks.linksLabel')}
                </label>
                <Textarea
                  class="min-h-32 font-mono text-xs"
                  placeholder={t('addLinks.linksPlaceholder')}
                  value={links()}
                  onInput={e => setLinks(e.currentTarget.value)}
                />
              </div>
              <TextField
                label={t('addLinks.packageName')}
                type="text"
                placeholder={t('addLinks.packageNamePlaceholder')}
                value={packageName()}
                onChange={setPackageName}
              />
              <TextField
                label={t('addLinks.extractPass')}
                type="text"
                placeholder={t('addLinks.extractPassPlaceholder')}
                value={extractPass()}
                onChange={setExtractPass}
              />
            </div>
          </TabsContent>

          <TabsContent value="dlc">
            <div class="flex flex-col gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addLinks.dlcUpload')}
                </label>
                <Input
                  type="file"
                  accept=".dlc"
                  class="cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                  onChange={handleFileUpload}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('addLinks.dlcContent')}
                </label>
                <Textarea
                  class="min-h-24 font-mono text-xs"
                  placeholder={t('addLinks.dlcPlaceholder')}
                  value={dlcContent()}
                  onInput={e => setDlcContent(e.currentTarget.value)}
                />
              </div>
            </div>
          </TabsContent>

          {/* Autostart */}
          <Switch checked={autostart()} onChange={setAutostart} label={t('addLinks.autostart')} />

          <Show when={error()}>
            <div class="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
              {error()}
            </div>
          </Show>
        </div>
      </TabsRoot>

      {/* Footer */}
      <div class="flex justify-end gap-3 p-5 pt-0">
        <Button variant="secondary" onClick={props.onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="default"
          onClick={tab() === 'links' ? handleAddLinks : handleAddDlc}
          disabled={loading()}
        >
          {t('common.add')}
        </Button>
      </div>
    </Dialog>
  );
};

export default AddLinksDialog;
