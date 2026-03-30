import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createSignal, onMount, Show } from 'solid-js';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { t } from '../i18n';
import { authApi } from '../lib/api';
import { authStore } from '../stores/auth';

const Login: Component = () => {
  const navigate = useNavigate();
  const [isFirstUser, setIsFirstUser] = createSignal(false);
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [name, setName] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const isRegister = () => isFirstUser();

  onMount(async () => {
    try {
      const { hasUsers } = await authApi.checkUsers();
      if (!hasUsers) {
        setIsFirstUser(true);
      }
    } catch {}
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister()) {
        if (!name().trim()) {
          setError(t('login.errorName'));
          return;
        }
        await authStore.signUp(email(), password(), name());
      } else {
        await authStore.signIn(email(), password());
      }
      navigate('/downloads');
    } catch (err) {
      setError((err as Error).message || t('login.errorLogin'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-background p-4">
      <div class="w-full max-w-sm">
        {/* Logo */}
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-4 shadow-lg">
            <span class="i-tabler-ghost-filled w-7 h-7 text-primary-foreground" />
          </div>
          <h1 class="text-2xl font-bold text-foreground">JDownloader</h1>
          <Show when={isRegister()}>
            <p class="text-sm text-muted-foreground mt-1">{t('login.subtitleRegister')}</p>
          </Show>
        </div>

        {/* Form */}
        <div class="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <Show when={isRegister()}>
              <TextField
                label={t('login.name')}
                type="text"
                placeholder={t('login.namePlaceholder')}
                value={name()}
                onChange={setName}
                required
                inputProps={{ autocomplete: 'name' }}
              />
            </Show>

            <TextField
              label={t('login.email')}
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email()}
              onChange={setEmail}
              required
              inputProps={{ autocomplete: 'email' }}
            />

            <TextField
              label={t('login.password')}
              type="password"
              placeholder={t('login.passwordPlaceholder')}
              value={password()}
              onChange={setPassword}
              required
              inputProps={{ autocomplete: isRegister() ? 'new-password' : 'current-password', minLength: 8 }}
            />

            <Show when={error()}>
              <div class="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
                {error()}
              </div>
            </Show>

            <Button
              type="submit"
              variant="default"
              class="w-full justify-center py-2.5"
              disabled={loading()}
            >
              <Show when={loading()}>
                <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
              </Show>
              {isRegister() ? t('login.register') : t('login.login')}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Login;
