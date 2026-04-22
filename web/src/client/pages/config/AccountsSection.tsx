import type { Component } from 'solid-js';
import type { JdAccount } from '../../lib/api';
import {

  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import { language, t, tf } from '../../i18n';
import { configApi, formatBytes } from '../../lib/api';

const AccountsSection: Component = () => {
  const [accounts, { refetch }] = createResource(() => configApi.listAccounts());
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal<number | 'all' | null>(null);

  // Add-Account dialog
  const [showAdd, setShowAdd] = createSignal(false);
  const [addHoster, setAddHoster] = createSignal('');
  const [addUser, setAddUser] = createSignal('');
  const [addPass, setAddPass] = createSignal('');
  const [addSaving, setAddSaving] = createSignal(false);

  // Hoster combobox
  const [hosters, setHosters] = createSignal<string[]>([]);
  const [hostersLoading, setHostersLoading] = createSignal(false);
  const [hosterSearch, setHosterSearch] = createSignal('');
  const [hosterOpen, setHosterOpen] = createSignal(false);

  const filteredHosters = createMemo(() => {
    const q = hosterSearch().toLowerCase().trim();
    return q ? hosters().filter(h => h.toLowerCase().includes(q)).slice(0, 80) : hosters().slice(0, 80);
  });

  const openAddDialog = async () => {
    setShowAdd(true);
    setHosterSearch('');
    setAddHoster('');
    if (hosters().length === 0) {
      setHostersLoading(true);
      try {
        const list = await configApi.listPremiumHosters();
        setHosters(Array.isArray(list) ? list : []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setHostersLoading(false);
      }
    }
  };

  const selectHoster = (h: string) => {
    setAddHoster(h);
    setHosterSearch(h);
    setHosterOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && hosterOpen()) {
      setHosterOpen(false);
    }
  };
  onMount(() => document.addEventListener('keydown', onKeyDown));
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  const [confirmDeleteAcc, setConfirmDeleteAcc] = createSignal<JdAccount | null>(null);

  // Change-Credentials dialog
  const [credAccId, setCredAccId] = createSignal<number | null>(null);
  const [credUser, setCredUser] = createSignal('');
  const [credPass, setCredPass] = createSignal('');
  const [credSaving, setCredSaving] = createSignal(false);

  const accs = () => (accounts() ?? []) as JdAccount[];

  const withError = async (fn: () => Promise<void>) => {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleAccount = (acc: JdAccount) =>
    withError(async () => {
      setBusy(acc.uuid);
      if (acc.enabled) {
        await configApi.disableAccounts([acc.uuid]);
      } else {
        await configApi.enableAccounts([acc.uuid]);
      }
      await refetch();
      setBusy(null);
    });

  const refreshAccount = (acc: JdAccount) =>
    withError(async () => {
      setBusy(acc.uuid);
      await configApi.refreshAccounts([acc.uuid]);
      await refetch();
      setBusy(null);
    });

  const refreshAll = () =>
    withError(async () => {
      setBusy('all');
      await configApi.refreshAccounts(accs().map(a => a.uuid));
      await refetch();
      setBusy(null);
    });

  const deleteAccount = () =>
    withError(async () => {
      const acc = confirmDeleteAcc();
      if (!acc) {
        return;
      }
      setConfirmDeleteAcc(null);
      await configApi.deleteAccount(acc.uuid);
      refetch();
    });

  const submitAdd = async (e: Event) => {
    e.preventDefault();
    setAddSaving(true);
    setError('');
    try {
      await configApi.addAccount(addHoster().trim(), addUser().trim(), addPass());
      setShowAdd(false);
      setAddHoster('');
      setAddUser('');
      setAddPass('');
      setHosterSearch('');
      setHosterOpen(false);
      refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddSaving(false);
    }
  };

  const openCred = (acc: JdAccount) => {
    setCredAccId(acc.uuid);
    setCredUser(acc.username);
    setCredPass('');
  };

  const submitCred = async (e: Event) => {
    e.preventDefault();
    const id = credAccId();
    if (!id) {
      return;
    }
    setCredSaving(true);
    setError('');
    try {
      await configApi.setCredentials(id, credUser().trim(), credPass());
      setCredAccId(null);
      setCredUser('');
      setCredPass('');
      refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCredSaving(false);
    }
  };

  const formatExpiry = (ms: number) => {
    if (!ms || ms <= 0) {
      return '–';
    }
    return new Date(ms).toLocaleDateString(language(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const trafficInfo = (acc: JdAccount) => {
    if (acc.trafficLeft === -1) {
      return t('config.accounts.unlimited');
    }
    if (acc.trafficLeft <= 0) {
      return null;
    }
    return acc.trafficMax > 0
      ? `${formatBytes(acc.trafficLeft)} / ${formatBytes(acc.trafficMax)}`
      : formatBytes(acc.trafficLeft);
  };

  return (
    <div class="space-y-4">
      <Show when={error()}>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
          {error()}
        </div>
      </Show>

      {/* Toolbar */}
      <div class="flex gap-2 justify-end">
        <Button variant="secondary" onClick={refreshAll} disabled={busy() === 'all'}>
          <Show when={busy() === 'all'} fallback={<span class="i-tabler-refresh w-4 h-4" />}>
            <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
          </Show>
          {t('config.accounts.refreshAll')}
        </Button>
        <Button variant="default" onClick={openAddDialog}>
          <span class="i-tabler-plus w-4 h-4" />
          {t('config.accounts.add')}
        </Button>
      </div>

      <Show when={accounts.loading}>
        <SkeletonList rows={4} />
      </Show>

      <Show when={!accounts.loading && accs().length === 0}>
        <div class="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <span class="i-tabler-user-off w-10 h-10 mb-2" />
          <p class="text-sm">{t('config.accounts.empty')}</p>
        </div>
      </Show>

      <Show when={!accounts.loading && accs().length > 0}>
        <div class="card overflow-hidden">
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
                        {formatExpiry(acc.validUntil)}
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
                    onClick={() => refreshAccount(acc)}
                    disabled={busy() === acc.uuid}
                    title={t('config.accounts.btnRefresh')}
                  >
                    <Show when={busy() === acc.uuid} fallback={<span class="i-tabler-refresh w-4 h-4" />}>
                      <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
                    </Show>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openCred(acc)}
                    title={t('config.accounts.btnChangeCreds')}
                  >
                    <span class="i-tabler-key w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDeleteAcc(acc)}
                    class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={t('config.accounts.btnDelete')}
                  >
                    <span class="i-tabler-trash w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Dialog
        open={showAdd()}
        onClose={() => {
          setShowAdd(false);
          setHosterSearch('');
          setHosterOpen(false);
        }}
        title={t('config.accounts.addModal.title')}
      >
        <form onSubmit={submitAdd} class="px-6 py-4 space-y-3">
          <div>
            <TextField
              label={t('config.accounts.addModal.hoster')}
              type="text"
              value={hosterSearch()}
              onChange={(v) => {
                setHosterSearch(v);
                setAddHoster(v);
                setHosterOpen(true);
              }}
              placeholder={t('config.accounts.addModal.hosterPlaceholder')}
              inputProps={{
                onFocus: () => setHosterOpen(true),
                onBlur: () => setTimeout(setHosterOpen, 150, false),
                autocomplete: 'off',
                required: true,
              }}
            />
            <Show when={hostersLoading()}>
              <p class="text-xs text-muted-foreground mt-1">{t('config.accounts.addModal.hosterLoading')}</p>
            </Show>
            <Show when={hosterOpen() && filteredHosters().length > 0}>
              <div class="mt-1 border rounded-lg bg-card max-h-48 overflow-y-auto shadow-sm">
                <For each={filteredHosters()}>
                  {h => (
                    <button
                      type="button"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onMouseDown={() => selectHoster(h)}
                    >
                      {h}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <TextField
            label={t('config.accounts.addModal.username')}
            type="text"
            value={addUser()}
            onChange={setAddUser}
            inputProps={{ required: true }}
          />
          <TextField
            label={t('config.accounts.addModal.password')}
            type="password"
            value={addPass()}
            onChange={setAddPass}
            inputProps={{ required: true }}
          />
          <div class="flex gap-2 pt-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAdd(false);
                setHosterSearch('');
                setHosterOpen(false);
              }}
            >
              {t('config.accounts.addModal.cancel')}
            </Button>
            <Button type="submit" variant="default" disabled={addSaving()}>
              <Show when={addSaving()}>
                <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
              </Show>
              {t('config.accounts.addModal.add')}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={confirmDeleteAcc() !== null} onClose={() => setConfirmDeleteAcc(null)} title={t('config.accounts.btnDelete')}>
        <div class="px-6 py-4 space-y-4">
          <p class="text-sm text-foreground">{tf('config.accounts.confirmDelete', confirmDeleteAcc()?.username ?? '', confirmDeleteAcc()?.hostname ?? '')}</p>
          <div class="flex items-center gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirmDeleteAcc(null)}>{t('config.accounts.addModal.cancel')}</Button>
            <Button variant="danger" onClick={deleteAccount}>{t('config.accounts.btnDelete')}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={credAccId() !== null} onClose={() => setCredAccId(null)} title={t('config.accounts.credsModal.title')}>
        <form onSubmit={submitCred} class="px-6 py-4 space-y-3">
          <TextField
            label={t('config.accounts.credsModal.username')}
            type="text"
            value={credUser()}
            onChange={setCredUser}
            inputProps={{ required: true }}
          />
          <TextField
            label={t('config.accounts.credsModal.password')}
            type="password"
            value={credPass()}
            onChange={setCredPass}
            inputProps={{ required: true }}
          />
          <div class="flex items-center gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setCredAccId(null)}>
              {t('config.accounts.credsModal.cancel')}
            </Button>
            <Button type="submit" variant="default" disabled={credSaving()}>
              <Show when={credSaving()} fallback={<span class="i-tabler-check w-4 h-4" />}>
                <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
              </Show>
              {t('config.accounts.credsModal.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default AccountsSection;
