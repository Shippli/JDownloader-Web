import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { t } from '../i18n';
import { authStore } from '../stores/auth';

const Login: Component = () => {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authStore.signIn(email(), password());
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
        </div>

        {/* Form */}
        <div class="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
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
              inputProps={{ autocomplete: 'current-password', minLength: 8 }}
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
              {t('login.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
