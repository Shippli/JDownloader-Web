import type { Component } from 'solid-js';
import type { UserRecord } from '../../lib/api';
import {

  createResource,
  createSignal,
  For,
  Show,
} from 'solid-js';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Dialog } from '../../components/ui/Dialog';
import { SkeletonList } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { t, tf } from '../../i18n';
import { formatDate, userApi } from '../../lib/api';
import { authStore } from '../../stores/auth';

const AddUserDialog: Component<{ open: boolean; onClose: () => void; onAdded: () => void }> = (props) => {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [adding, setAdding] = createSignal(false);

  const close = () => {
    setError('');
    setName('');
    setEmail('');
    setPassword('');
    props.onClose();
  };

  const add = async () => {
    setAdding(true);
    setError('');
    try {
      await userApi.create({ name: name(), email: email(), password: password() });
      close();
      props.onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={props.open} onClose={close} title={t('config.users.addModal.title')}>
      <div class="px-6 py-4 space-y-3">
        <Show when={error()}>
          <Alert>{error()}</Alert>
        </Show>
        <TextField
          label={t('config.users.addModal.name')}
          type="text"
          value={name()}
          onChange={setName}
          placeholder={t('config.users.addModal.namePlaceholder')}
        />
        <TextField
          label={t('config.users.addModal.email')}
          type="email"
          value={email()}
          onChange={setEmail}
          placeholder={t('config.users.addModal.emailPlaceholder')}
        />
        <TextField
          label={t('config.users.addModal.password')}
          type="password"
          value={password()}
          onChange={setPassword}
          placeholder={t('config.users.addModal.passwordPlaceholder')}
          inputProps={{ minLength: 8, autocomplete: 'new-password' }}
        />
        <div class="flex items-center gap-2 pt-1 justify-end">
          <Button variant="secondary" onClick={close}>
            {t('config.users.addModal.cancel')}
          </Button>
          <Button variant="default" onClick={add} loading={adding()}>
            {t('config.users.addModal.add')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

const UsersSection: Component = () => {
  const [users, { refetch }] = createResource(() => userApi.list());
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal('');
  const [editEmail, setEditEmail] = createSignal('');
  const [editPassword, setEditPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  const [showAdd, setShowAdd] = createSignal(false);

  const [confirmDeleteUser, setConfirmDeleteUser] = createSignal<UserRecord | null>(null);

  const currentUserId = () => authStore.user()?.id;

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

  return (
    <div class="space-y-4">
      <Show when={error()}>
        <Alert>{error()}</Alert>
      </Show>

      <div class="flex gap-2 justify-end">
        <Button variant="default" onClick={() => setShowAdd(true)} icon="i-tabler-user-plus">
          {t('config.users.add')}
        </Button>
      </div>

      <AddUserDialog open={showAdd()} onClose={() => setShowAdd(false)} onAdded={refetch} />

      <Show when={users.loading}>
        <SkeletonList rows={3} />
      </Show>

      <ConfirmDialog
        open={confirmDeleteUser() !== null}
        title={t('config.users.btnDelete')}
        message={tf('config.users.confirmDelete', confirmDeleteUser()?.name ?? '')}
        confirmLabel={t('config.users.btnDelete')}
        onConfirm={deleteUser}
        onClose={() => setConfirmDeleteUser(null)}
      />

      <Show when={!users.loading}>
        <Card class="overflow-hidden">
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
                              <Badge class="bg-accent text-accent-foreground">{t('config.users.you')}</Badge>
                            </Show>
                          </div>
                          <p class="text-xs text-muted-foreground">{u.email}</p>
                          <p class="text-xs text-muted-foreground mt-0.5">
                            {t('config.users.created')}
                            {formatDate(u.createdAt)}
                          </p>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(u)} title={t('config.users.btnEdit')} icon="i-tabler-edit" />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDeleteUser(u)}
                            disabled={isSelf()}
                            class="text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf() ? t('config.users.btnCannotDelete') : t('config.users.btnDelete')}
                            icon="i-tabler-trash"
                          />
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
                        <Button variant="default" onClick={() => saveEdit(u.id)} loading={saving()} icon="i-tabler-check">
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
        </Card>
      </Show>
    </div>
  );
};

export default UsersSection;
