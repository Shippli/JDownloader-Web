import type { Component, JSX } from 'solid-js';
import type { DownloadConfig } from '../../../lib/api';
import { createResource, createSignal, Show } from 'solid-js';
import { ConfigSection } from '../../../components/ConfigSection';
import { FormActions } from '../../../components/FormActions';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { NumberField } from '../../../components/ui/NumberField';
import { SkeletonTable } from '../../../components/ui/Skeleton';
import { TextField } from '../../../components/ui/TextField';
import { t } from '../../../i18n';
import { configApi } from '../../../lib/api';

type RowProps = {
  label: string;
  value: string;
  editing: boolean;
  saving: boolean;
  error: string;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: JSX.Element;
};

const ConfigRow: Component<RowProps> = props => (
  <div class="border-b last:border-0 px-4 py-3">
    <Show
      when={props.editing}
      fallback={(
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm text-muted-foreground">{props.label}</span>
          <div class="flex items-center gap-3">
            <span class="text-sm font-mono text-foreground">{props.value}</span>
            <Button variant="ghost" size="icon" onClick={() => props.onEdit()} title={t('config.info.btnEdit')} icon="i-tabler-edit" />
          </div>
        </div>
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave();
        }}
        class="space-y-2"
      >
        {props.children}
        <Show when={props.error}>
          <p class="text-xs text-destructive">{props.error}</p>
        </Show>
        <FormActions saving={props.saving} onCancel={props.onCancel} />
      </form>
    </Show>
  </div>
);

type RowKey = 'MaxChunksPerFile' | 'MaxSimultaneDownloads' | 'MaxPerHost' | 'DefaultDownloadFolder' | 'DownloadSpeedLimit';

export const DownloadConfigCard: Component = () => {
  const [config, { refetch }] = createResource(() => configApi.getDownloadConfig().catch(() => null));
  const [editingRow, setEditingRow] = createSignal<RowKey | null>(null);
  const [editText, setEditText] = createSignal('');
  const [editBool, setEditBool] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  const startEdit = (key: RowKey, text: unknown, bool = false) => {
    setEditingRow(key);
    setEditText(String(text ?? ''));
    setEditBool(bool);
    setError('');
  };

  const save = async (write: Promise<unknown>) => {
    setSaving(true);
    setError('');
    try {
      await write;
      await refetch();
      setEditingRow(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setNumber = (key: keyof DownloadConfig, multiplier = 1) =>
    save(configApi.setDownloadConfig(key, Number.parseInt(editText()) * multiplier));

  const row = (key: RowKey) => ({
    editing: editingRow() === key,
    saving: saving(),
    error: error(),
    onCancel: () => setEditingRow(null),
  });

  const speedLabel = (bytesPerSec: number) =>
    bytesPerSec > 0 ? `${Math.round(bytesPerSec / 1024)} ${t('config.dlconfig.speedLimitUnit')}` : t('config.dlconfig.speedUnlimited');

  const numberInput = (max?: number) => <NumberField value={editText()} onChange={setEditText} minValue={max ? 1 : 0} maxValue={max} />;

  return (
    <ConfigSection title={t('config.dlconfig.title')}>
      <Show when={config()} fallback={<SkeletonTable rows={4} />}>
        {c => (
          <Card class="overflow-hidden">
            <ConfigRow
              {...row('MaxChunksPerFile')}
              label={t('config.dlconfig.maxChunks')}
              value={String(c().MaxChunksPerFile ?? '–')}
              onEdit={() => startEdit('MaxChunksPerFile', c().MaxChunksPerFile)}
              onSave={() => setNumber('MaxChunksPerFile')}
            >
              {numberInput(20)}
            </ConfigRow>
            <ConfigRow
              {...row('MaxSimultaneDownloads')}
              label={t('config.dlconfig.maxParallel')}
              value={String(c().MaxSimultaneDownloads ?? '–')}
              onEdit={() => startEdit('MaxSimultaneDownloads', c().MaxSimultaneDownloads)}
              onSave={() => setNumber('MaxSimultaneDownloads')}
            >
              {numberInput(20)}
            </ConfigRow>
            <ConfigRow
              {...row('MaxPerHost')}
              label={t('config.dlconfig.maxPerHost')}
              value={c().MaxDownloadsPerHostEnabled ? String(c().MaxSimultaneDownloadsPerHost ?? '–') : t('common.disabled')}
              onEdit={() => startEdit('MaxPerHost', c().MaxSimultaneDownloadsPerHost, c().MaxDownloadsPerHostEnabled ?? false)}
              onSave={() => save(Promise.all([
                configApi.setDownloadConfig('MaxDownloadsPerHostEnabled', editBool()),
                configApi.setDownloadConfig('MaxSimultaneDownloadsPerHost', Number.parseInt(editText())),
              ]))}
            >
              <div class="space-y-2">
                <Checkbox checked={editBool()} onChange={setEditBool} label={t('config.dlconfig.maxPerHostEnabled')} />
                <Show when={editBool()}>{numberInput(20)}</Show>
              </div>
            </ConfigRow>
            <ConfigRow
              {...row('DefaultDownloadFolder')}
              label={t('config.dlconfig.downloadFolder')}
              value={c().DefaultDownloadFolder ?? '–'}
              onEdit={() => startEdit('DefaultDownloadFolder', c().DefaultDownloadFolder)}
              onSave={() => save(configApi.setDownloadConfig('DefaultDownloadFolder', editText()))}
            >
              <TextField value={editText()} onChange={setEditText} inputClass="font-mono" placeholder="/path/to/downloads" />
            </ConfigRow>
            <ConfigRow
              {...row('DownloadSpeedLimit')}
              label={t('config.dlconfig.speedLimit')}
              value={speedLabel(c().DownloadSpeedLimit ?? 0)}
              onEdit={() => startEdit('DownloadSpeedLimit', Math.round((c().DownloadSpeedLimit ?? 0) / 1024))}
              onSave={() => setNumber('DownloadSpeedLimit', 1024)}
            >
              <div class="flex items-center gap-2">
                {numberInput()}
                <span class="text-sm text-muted-foreground shrink-0">
                  {`${t('config.dlconfig.speedLimitUnit')} (0 = ${t('config.dlconfig.speedUnlimited')})`}
                </span>
              </div>
            </ConfigRow>
          </Card>
        )}
      </Show>
    </ConfigSection>
  );
};
