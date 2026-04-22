import type { Component } from 'solid-js';
import type { UserRecord } from '../../lib/api';
import {

  createResource,
  createSignal,
  For,
  Show,
} from 'solid-js';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SkeletonList } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { language, t, tf } from '../../i18n';
import { userApi } from '../../lib/api';
import { authStore } from '../../stores/auth';

const UsersSection: Component = () => {
  const [users, { refetch }] = createResource(() => userApi.list());
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal('');
  const [editEmail, setEditEmail] = createSignal('');
  const [editPassword, setEditPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const [showAdd, setShowAdd] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [newEmail, setNewEmail] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [addError, setAddError] = createSignal('');
  const [adding, setAdding] = createSignal(false);

  const [confirmDeleteUser, setConfirmDeleteUser] = createSignal<UserRecord | null>(null);

  const currentUserId = () => authStore.user()?.id;

  const closeAddModal = () => {
    setShowAdd(false);
    setAddError('');
    setNewName('');
    setNewEmail('');
    setNewPassword('');
  };

  const startEdit = (u: UserRecord) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword('');
    setError('');
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await userApi.update(id, { name: editName(), email: editEmail() });
      if (editPassword()) {
        await userApi.changePassword(id, editPassword());
      }
      setEditingId(null);
      refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    const u = confirmDeleteUser();
    if (!u) {
      return;
    }
    setConfirmDeleteUser(null);
    setError('');
    try {
      await userApi.delete(u.id);
      refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addUser = async () => {
    setAdding(true);
    setAddError('');
    try {
      await userApi.create({ name: newName(), email: newEmail(), password: newPassword() });
      setShowAdd(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      refetch();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(language(), { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div class="space-y-4">
      <Show when={error()}>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
          {error()}
        </div>
      </Show>

      <div class="flex gap-2 justify-end">
        <Button
          variant="default"
          onClick={() => {
            setShowAdd(true);
            setAddError('');
          }}
        >
          <span class="i-tabler-user-plus w-4 h-4" />
          {t('config.users.add')}
        </Button>
      </div>

      <Dialog open={showAdd()} onClose={closeAddModal} title={t('config.users.addModal.title')}>
        <div class="px-6 py-4 space-y-3">
          <Show when={addError()}>
            <div class="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
              {addError()}
            </div>
          </Show>
          <TextField
            label={t('config.users.addModal.name')}
            type="text"
            value={newName()}
            onChange={setNewName}
            placeholder={t('config.users.addModal.namePlaceholder')}
          />
          <TextField
            label={t('config.users.addModal.email')}
            type="email"
            value={newEmail()}
            onChange={setNewEmail}
            placeholder={t('config.users.addModal.emailPlaceholder')}
          />
          <TextField
            label={t('config.users.addModal.password')}
            type="password"
            value={newPassword()}
            onChange={setNewPassword}
            placeholder={t('config.users.addModal.passwordPlaceholder')}
            inputProps={{ minLength: 8, autocomplete: 'new-password' }}
          />
          <div class="flex items-center gap-2 pt-1 justify-end">
            <Button variant="secondary" onClick={() => closeAddModal()}>
              {t('config.users.addModal.cancel')}
            </Button>
            <Button variant="default" onClick={addUser} disabled={adding()}>
              <Show when={adding()}>
                <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
              </Show>
              {t('config.users.addModal.add')}
            </Button>
          </div>
        </div>
      </Dialog>

      <Show when={users.loading}>
        <SkeletonList rows={3} />
      </Show>

      <Dialog open={confirmDeleteUser() !== null} onClose={() => setConfirmDeleteUser(null)} title={t('config.users.btnDelete')}>
        <div class="px-6 py-4 space-y-4">
          <p class="text-sm text-foreground">{tf('config.users.confirmDelete', confirmDeleteUser()?.name ?? '')}</p>
          <div class="flex items-center gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirmDeleteUser(null)}>{t('config.users.cancel')}</Button>
            <Button variant="danger" onClick={deleteUser}>{t('config.users.btnDelete')}</Button>
          </div>
        </div>
      </Dialog>

      <Show when={!users.loading}>
        <div class="card overflow-hidden">
          <For each={users()}>
            {(u) => {
              const isEditing = () => editingId() === u.id;
              const isSelf = () => currentUserId() === u.id;
              return (
                <div class="border-b last:border-0 px-4 py-3">
                  <Show
                    when={isEditing()}
                    fallback={(
                      <div class="flex items-center gap-3">
                        <Avatar name={u.name} size="md" />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <p class="text-sm font-medium text-foreground">{u.name}</p>
                            <Show when={isSelf()}>
                              <span class="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{t('config.users.you')}</span>
                            </Show>
                          </div>
                          <p class="text-xs text-muted-foreground">{u.email}</p>
                          <p class="text-xs text-muted-foreground mt-0.5">
                            {t('config.users.created')}
                            {formatDate(u.createdAt)}
                          </p>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(u)} title={t('config.users.btnEdit')}>
                            <span class="i-tabler-edit w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDeleteUser(u)}
                            disabled={isSelf()}
                            class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf() ? t('config.users.btnCannotDelete') : t('config.users.btnDelete')}
                          >
                            <span class="i-tabler-trash w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  >
                    <div class="space-y-3">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <TextField
                          label={t('config.users.editName')}
                          type="text"
                          value={editName()}
                          onChange={setEditName}
                        />
                        <TextField
                          label={t('config.users.editEmail')}
                          type="email"
                          value={editEmail()}
                          onChange={setEditEmail}
                        />
                        <TextField
                          label={t('config.users.editPassword')}
                          type="password"
                          value={editPassword()}
                          onChange={setEditPassword}
                          placeholder="••••••••"
                          inputProps={{ minLength: 8, autocomplete: 'new-password' }}
                          class="sm:col-span-2"
                        />
                      </div>
                      <div class="flex items-center gap-2 justify-end">
                        <Button variant="default" onClick={() => saveEdit(u.id)} disabled={saving()}>
                          <Show when={saving()} fallback={<span class="i-tabler-check w-4 h-4" />}>
                            <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
                          </Show>
                          {t('config.users.save')}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)}>{t('config.users.cancel')}</Button>
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default UsersSection;
