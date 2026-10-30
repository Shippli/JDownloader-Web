import type { Component } from 'solid-js';
import type { JdAccount } from '../../lib/api';
import { createEffect, createResource, createSignal, For, Show } from 'solid-js';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Combobox } from '../../components/ui/Combobox';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Dialog, DialogBody, DialogFooter } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import { t, tf } from '../../i18n';
import { configApi, formatBytes, formatDate } from '../../lib/api';

type DialogCallbacks = {
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

const MAX_HOSTER_SUGGESTIONS = 80;

const AddAccountDialog: Component<{ open: boolean } & DialogCallbacks> = (props) => {
  const [hoster, setHoster] = createSignal('');
  const [user, setUser] = createSignal('');
  const [pass, setPass] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [hosters, setHosters] = createSignal<string[]>([]);
  const [hostersLoading, setHostersLoading] = createSignal(false);
  let hostersRequested = false;
  // Loaded once, on first open.
  createEffect(() => {
    if (!props.open || hostersRequested) {
      return;
    }
    hostersRequested = true;
    setHostersLoading(true);
    const onError = props.onError;
    configApi.listPremiumHosters()
      .then(list => setHosters(Array.isArray(list)
        ? list
        : []))
      .catch(e => onError((e as Error).message))
      .finally(() => setHostersLoading(false));
  });

  const close = () => {
    setHoster('');
    setUser('');
    setPass('');
    props.onClose();
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    props.onError('');
    try {
      await configApi.addAccount(hoster().trim(), user().trim(), pass());
      close();
      props.onSaved();
    } catch (err) {
      props.onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onClose={close} title={t('config.accounts.addModal.title')}>
      <form onSubmit={submit}>
        <DialogBody>
          <div>
            <Combobox
              label={t('config.accounts.addModal.hoster')}
              value={hoster()}
              onChange={setHoster}
              options={hosters()}
              maxOptions={MAX_HOSTER_SUGGESTIONS}
              placeholder={t('config.accounts.addModal.hosterPlaceholder')}
              disabled={hostersLoading()}
              required
            />
            <Show when={hostersLoading()}>
              <p class="text-xs text-muted-foreground mt-1">{t('config.accounts.addModal.hosterLoading')}</p>
            </Show>
          </div>
          <TextField
            label={t('config.accounts.addModal.username')}
            type="text"
            value={user()}
            onChange={setUser}
            inputProps={{ required: true }}
          />
          <TextField
            label={t('config.accounts.addModal.password')}
            type="password"
            value={pass()}
            onChange={setPass}
            inputProps={{ required: true }}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="default" loading={saving()}>
              {t('config.accounts.addModal.add')}
            </Button>
          </DialogFooter>
        </DialogBody>
      </form>
    </Dialog>
  );
};

const CredentialsDialog: Component<{ account: JdAccount | null } & DialogCallbacks> = (props) => {
  const [user, setUser] = createSignal('');
  const [pass, setPass] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    setUser(props.account?.username ?? '');
    setPass('');
  });

  const submit = async (e: Event) => {
    e.preventDefault();
    const acc = props.account;
    if (!acc) {
      return;
    }
    setSaving(true);
    props.onError('');
    try {
      await configApi.setCredentials(acc.uuid, user().trim(), pass());
      props.onClose();
      props.onSaved();
    } catch (err) {
      props.onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.account !== null} onClose={props.onClose} title={t('config.accounts.credsModal.title')}>
      <form onSubmit={submit}>
        <DialogBody>
          <TextField
            label={t('config.accounts.credsModal.username')}
            type="text"
            value={user()}
            onChange={setUser}
            inputProps={{ required: true }}
          />
          <TextField
            label={t('config.accounts.credsModal.password')}
            type="password"
            value={pass()}
            onChange={setPass}
            inputProps={{ required: true }}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => props.onClose()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="default" loading={saving()} icon="i-tabler-check">
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogBody>
      </form>
    </Dialog>
  );
};

function trafficInfo(acc: JdAccount) {
  if (acc.trafficLeft === -1) {
    return t('config.accounts.unlimited');
  }
  if (acc.trafficLeft <= 0) {
    return null;
  }
  return acc.trafficMax > 0
    ? `${formatBytes(acc.trafficLeft)} / ${formatBytes(acc.trafficMax)}`
    : formatBytes(acc.trafficLeft);
}

const AccountsSection: Component = () => {
  const [accounts, { refetch }] = createResource(() => configApi.listAccounts());
  const accs = () => (accounts() ?? []) as JdAccount[];
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal<number | 'all' | null>(null);
  const [showAdd, setShowAdd] = createSignal(false);
  const [credAccount, setCredAccount] = createSignal<JdAccount | null>(null);
  const [confirmDeleteAcc, setConfirmDeleteAcc] = createSignal<JdAccount | null>(null);

  // Runs an account action with a busy marker, then reloads the list.
  const withBusy = async (key: number | 'all', action: () => Promise<unknown>) => {
    setError('');
    setBusy(key);
    try {
      await action();
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleAccount = (acc: JdAccount) =>
    withBusy(acc.uuid, () => acc.enabled
      ? configApi.disableAccounts([acc.uuid])
      : configApi.enableAccounts([acc.uuid]));

  const deleteAccount = () => {
    const acc = confirmDeleteAcc();
    setConfirmDeleteAcc(null);
    if (acc) {
      void withBusy(acc.uuid, () => configApi.deleteAccount(acc.uuid));
    }
  };

  return (
    <div class="space-y-4">
      <Show when={error()}>
        <Alert>{error()}</Alert>
      </Show>

      {/* Toolbar */}
      <div class="flex gap-2 justify-end">
        <Button
          variant="secondary"
          onClick={() => withBusy('all', () => configApi.refreshAccounts(accs().map(a => a.uuid)))}
          loading={busy() === 'all'}
          icon="i-tabler-refresh"
        >
          {t('config.accounts.refreshAll')}
        </Button>
        <Button variant="default" onClick={() => setShowAdd(true)} icon="i-tabler-plus">
          {t('config.accounts.add')}
        </Button>
      </div>

      <Show when={accounts.loading}>
        <SkeletonList rows={4} />
      </Show>

      <Show when={!accounts.loading && accs().length === 0}>
        <EmptyState icon="i-tabler-user-off" text={t('config.accounts.empty')} class="py-16" />
      </Show>

      <Show when={!accounts.loading && accs().length > 0}>
        <Card class="overflow-hidden">
          <For each={accs()}>
            {acc => (
              <div class="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                <Avatar name={acc.hostname} size="md" />

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium text-foreground">{acc.hostname}</span>
                    <Show when={acc.valid && acc.enabled}>
                      <Badge variant="success">{t('config.accounts.statusPremium')}</Badge>
                    </Show>
                    <Show when={!acc.valid}>
                      <Badge variant="danger">{t('config.accounts.statusInvalid')}</Badge>
                    </Show>
                    <Show when={!acc.enabled}>
                      <Badge variant="default">{t('config.accounts.statusDisabled')}</Badge>
                    </Show>
                  </div>
                  <p class="text-xs text-muted-foreground">{acc.username}</p>
                  <div class="flex items-center gap-3 flex-wrap mt-0.5">
                    <Show when={trafficInfo(acc)}>
                      <span class="text-xs text-muted-foreground">
                        {t('config.accounts.traffic')}
                        {trafficInfo(acc)}
                      </span>
                    </Show>
                    <Show when={acc.validUntil > 0}>
                      <span class="text-xs text-muted-foreground">
                        {t('config.accounts.expires')}
                        {formatDate(acc.validUntil)}
                      </span>
                    </Show>
                  </div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={!!acc.enabled}
                    onChange={() => toggleAccount(acc)}
                    disabled={busy() === acc.uuid}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => withBusy(acc.uuid, () => configApi.refreshAccounts([acc.uuid]))}
                    title={t('config.accounts.btnRefresh')}
                    loading={busy() === acc.uuid}
                    icon="i-tabler-refresh"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCredAccount(acc)}
                    title={t('config.accounts.btnChangeCreds')}
                    icon="i-tabler-key"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDeleteAcc(acc)}
                    class="text-destructive hover:bg-destructive/10"
                    title={t('config.accounts.btnDelete')}
                    icon="i-tabler-trash"
                  />
                </div>
              </div>
            )}
          </For>
        </Card>
      </Show>

      <AddAccountDialog open={showAdd()} onClose={() => setShowAdd(false)} onSaved={refetch} onError={setError} />
      <CredentialsDialog account={credAccount()} onClose={() => setCredAccount(null)} onSaved={refetch} onError={setError} />
      <ConfirmDialog
        open={confirmDeleteAcc() !== null}
        title={t('config.accounts.btnDelete')}
        message={tf('config.accounts.confirmDelete', confirmDeleteAcc()?.username ?? '', confirmDeleteAcc()?.hostname ?? '')}
        confirmLabel={t('config.accounts.btnDelete')}
        onConfirm={deleteAccount}
        onClose={() => setConfirmDeleteAcc(null)}
      />
    </div>
  );
};

export default AccountsSection;
