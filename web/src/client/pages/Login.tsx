import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import { BrandHeader } from '../components/BrandHeader';
import { Alert } from '../components/ui/Alert';
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
        <BrandHeader />

        {/* Form */}
        <div class="rounded-xl border bg-card p-6 shadow-xs">
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
              <Alert>{error()}</Alert>
            </Show>

            <Button
              type="submit"
              variant="default"
              class="w-full justify-center py-2.5"
              loading={loading()}
            >
              {t('login.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
