import type { Component } from 'solid-js';
import { createResource, createSignal, Show } from 'solid-js';
import { ConfigSection } from '../../../components/ConfigSection';
import { FormActions } from '../../../components/FormActions';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { NumberField } from '../../../components/ui/NumberField';
import { TextField } from '../../../components/ui/TextField';
import { t } from '../../../i18n';
import { configApi } from '../../../lib/api';

export const ConnectionCard: Component<{ onSaved: () => void }> = (props) => {
  const [conn, { refetch }] = createResource(() => configApi.getConnection());
  const [editing, setEditing] = createSignal(false);
  const [host, setHost] = createSignal('');
  const [port, setPort] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  const startEdit = () => {
    setHost(conn()?.host ?? '');
    setPort(conn()?.port ?? '');
    setError('');
    setEditing(true);
  };

  const save = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await configApi.setConnection(host().trim(), port().trim());
      setEditing(false);
      refetch();
      props.onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfigSection title={t('config.info.connection')}>
      <Card class="overflow-hidden">
        <Show
          when={!editing()}
          fallback={(
            <form onSubmit={save} class="px-4 py-3 space-y-3">
              <Show when={error()}>
                <Alert>{error()}</Alert>
              </Show>
              <div class="grid grid-cols-[1fr_auto] gap-3">
                <TextField label={t('config.info.host')} value={host()} onChange={setHost} required placeholder="0.0.0.0" />
                <div class="w-24">
                  <NumberField label={t('config.info.port')} value={Number(port())} onChange={v => setPort(String(v))} required minValue={1} maxValue={65535} placeholder="3128" />
                </div>
              </div>
              <FormActions saving={saving()} onCancel={() => setEditing(false)} />
            </form>
          )}
        >
          <div class="flex items-center justify-between px-4 py-3">
            <div>
              <p class="text-xs text-muted-foreground mb-0.5">{t('config.info.api')}</p>
              <Show
                when={!conn.loading}
                fallback={<span class="i-tabler-loader-2 animate-spin w-4 h-4 text-muted-foreground" />}
              >
                <p class="text-sm font-mono text-foreground">
                  {conn()?.host}
                  :
                  {conn()?.port}
                </p>
              </Show>
            </div>
            <Button variant="ghost" size="icon" onClick={startEdit} title={t('config.info.btnEdit')} icon="i-tabler-edit" />
          </div>
        </Show>
      </Card>
    </ConfigSection>
  );
};
