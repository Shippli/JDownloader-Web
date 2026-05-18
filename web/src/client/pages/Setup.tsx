import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { t } from '../i18n';
import { configApi, setupApi } from '../lib/api';
import { authStore } from '../stores/auth';

// ─── Step 1: Create Account ───────────────────────────────────────────────────

type AccountData = { name: string; email: string; password: string };

const StepAccount: Component<{
  data: AccountData;
  onChange: (data: AccountData) => void;
  onDone: () => void;
}> = (props) => {
  const [error, setError] = createSignal('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!props.data.name.trim()) {
      setError(t('login.errorName'));
      return;
    }
    if (props.data.password.length < 8) {
      setError(t('login.errorPassword'));
      return;
    }
    setError('');
    props.onDone();
  };

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <TextField
        label={t('login.name')}
        type="text"
        placeholder={t('login.namePlaceholder')}
        value={props.data.name}
        onChange={v => props.onChange({ ...props.data, name: v })}
        required
        inputProps={{ autocomplete: 'name' }}
      />
      <TextField
        label={t('login.email')}
        type="email"
        placeholder={t('login.emailPlaceholder')}
        value={props.data.email}
        onChange={v => props.onChange({ ...props.data, email: v })}
        required
        inputProps={{ autocomplete: 'email' }}
      />
      <TextField
        label={t('login.password')}
        type="password"
        placeholder={t('login.passwordPlaceholder')}
        value={props.data.password}
        onChange={v => props.onChange({ ...props.data, password: v })}
        required
        inputProps={{ autocomplete: 'new-password', minLength: 8 }}
      />
      <Show when={error()}>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
          {error()}
        </div>
      </Show>
      <Button type="submit" class="w-full justify-center py-2.5 mt-2">
        {t('setup.next')}
        <span class="i-tabler-arrow-right w-4 h-4" />
      </Button>
    </form>
  );
};

// ─── Step 2: Enable Remote Control ───────────────────────────────────────────

const StepRemoteControl: Component<{ onDone: () => void; onBack: () => void }> = (props) => {
  const steps = [
    t('setup.step2Step1'),
    t('setup.step2Step2'),
    t('setup.step2Step3'),
    t('setup.step2Step4'),
  ];

  return (
    <div class="flex flex-col gap-6">
      <ol class="flex flex-col gap-3">
        <For each={steps}>
          {(step, i) => (
            <li class="flex items-start gap-3">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                {i() + 1}
              </span>
              <span class="text-sm text-foreground leading-relaxed">{step}</span>
            </li>
          )}
        </For>
      </ol>
      <div class="flex gap-3">
        <Button variant="outline" class="flex-1 justify-center py-2.5" onClick={props.onBack}>
          <span class="i-tabler-arrow-left w-4 h-4" />
          {t('setup.back')}
        </Button>
        <Button class="flex-1 justify-center py-2.5" onClick={props.onDone}>
          {t('setup.next')}
          <span class="i-tabler-arrow-right w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// ─── Step 3: JD Connection ────────────────────────────────────────────────────

type ConnectionData = { host: string; port: string };

const StepConnection: Component<{
  data: ConnectionData;
  onChange: (data: ConnectionData) => void;
  onFinish: () => Promise<void>;
  onBack: () => void;
}> = (props) => {
  const [testing, setTesting] = createSignal(false);
  const [finishing, setFinishing] = createSignal(false);
  const [tested, setTested] = createSignal(false);
  const [testError, setTestError] = createSignal('');
  const [finishError, setFinishError] = createSignal('');

  const resetTest = () => {
    setTested(false);
    setTestError('');
  };

  const handleTest = async () => {
    const { host, port } = props.data;
    if (!host.trim() || !port.trim()) {
      return;
    }
    setTesting(true);
    resetTest();
    try {
      const result = await setupApi.testConnection(host.trim(), port.trim());
      if (result.ok) {
        setTested(true);
      } else {
        setTestError(result.error ?? 'Connection failed');
      }
    } catch (err) {
      setTestError((err as Error).message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = async () => {
    setFinishing(true);
    setFinishError('');
    try {
      await props.onFinish();
    } catch (err) {
      setFinishError((err as Error).message || 'Setup failed');
      setFinishing(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <TextField
        label={t('setup.host')}
        type="text"
        placeholder={t('setup.hostPlaceholder')}
        value={props.data.host}
        onChange={(v) => {
          props.onChange({ ...props.data, host: v });
          resetTest();
        }}
        inputProps={{ autocomplete: 'off' }}
      />
      <TextField
        label={t('setup.port')}
        type="number"
        placeholder="3128"
        value={props.data.port}
        onChange={(v) => {
          props.onChange({ ...props.data, port: v });
          resetTest();
        }}
        inputProps={{ min: 1, max: 65535 }}
      />

      <Button
        variant="outline"
        class="w-full justify-center py-2.5"
        onClick={handleTest}
        disabled={testing() || !props.data.host.trim() || !props.data.port.trim()}
      >
        <Show when={testing()}>
          <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
        </Show>
        <Show when={!testing()}>
          <span class="i-tabler-plug w-4 h-4" />
        </Show>
        {t('setup.testConnection')}
      </Button>

      <Show when={tested()}>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
          <span class="i-tabler-circle-check w-4 h-4 flex-shrink-0" />
          {t('setup.testSuccess')}
        </div>
      </Show>

      <Show when={testError()}>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
          {testError()}
        </div>
      </Show>

      <Show when={finishError()}>
        <div class="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <span class="i-tabler-alert-circle w-4 h-4 flex-shrink-0" />
          {finishError()}
        </div>
      </Show>

      <div class="flex gap-3">
        <Button variant="outline" class="flex-1 justify-center py-2.5" onClick={props.onBack} disabled={finishing()}>
          <span class="i-tabler-arrow-left w-4 h-4" />
          {t('setup.back')}
        </Button>
        <Button
          class="flex-1 justify-center py-2.5"
          onClick={handleFinish}
          disabled={!tested() || finishing()}
        >
          <Show when={finishing()}>
            <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
          </Show>
          <Show when={!finishing()}>
            <span class="i-tabler-check w-4 h-4" />
          </Show>
          {t('setup.finish')}
        </Button>
      </div>
    </div>
  );
};

// ─── Step Stepper ─────────────────────────────────────────────────────────────

const STEPS = [
  { labelKey: 'setup.step1Label', titleKey: 'setup.step1Title', subtitleKey: 'setup.step1Subtitle' },
  { labelKey: 'setup.step2Label', titleKey: 'setup.step2Title', subtitleKey: 'setup.step2Subtitle' },
  { labelKey: 'setup.step3Label', titleKey: 'setup.step3Title', subtitleKey: 'setup.step3Subtitle' },
];

const Stepper: Component<{ current: number }> = props => (
  <div class="flex items-center w-full mb-8">
    <For each={STEPS}>
      {(s, i) => {
        const idx = () => i() + 1;
        const done = () => idx() < props.current;
        const active = () => idx() === props.current;
        return (
          <>
            <div class="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                class={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  done()
                    ? 'bg-primary text-primary-foreground'
                    : active()
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                <Show when={done()} fallback={<span>{idx()}</span>}>
                  <span class="i-tabler-check w-4 h-4" />
                </Show>
              </div>
              <span
                class={`text-xs font-medium whitespace-nowrap transition-colors ${
                  active() ? 'text-foreground' : done() ? 'text-foreground/70' : 'text-muted-foreground'
                }`}
              >
                {t(s.labelKey)}
              </span>
            </div>
            <Show when={i() < STEPS.length - 1}>
              <div
                class={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                  idx() < props.current ? 'bg-primary' : 'bg-muted'
                }`}
              />
            </Show>
          </>
        );
      }}
    </For>
  </div>
);

// ─── Main Setup Page ──────────────────────────────────────────────────────────

const Setup: Component = () => {
  const navigate = useNavigate();
  const [step, setStep] = createSignal(1);
  const next = () => setStep(s => s + 1);
  const prev = () => setStep(s => s - 1);

  const [account, setAccount] = createSignal<AccountData>({ name: '', email: '', password: '' });
  const [connection, setConnection] = createSignal<ConnectionData>({ host: '', port: '3128' });

  const current = () => STEPS[step() - 1];

  const handleFinish = async () => {
    const { name, email, password } = account();
    const { host, port } = connection();
    await authStore.signUp(email, password, name);
    await configApi.setConnection(host.trim(), port.trim());
    await setupApi.complete();
    navigate('/downloads', { replace: true });
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-background p-4">
      <div class="w-full max-w-lg">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-4 shadow-lg">
            <span class="i-tabler-ghost-filled w-7 h-7 text-primary-foreground" />
          </div>
          <h1 class="text-2xl font-bold text-foreground">JDownloader</h1>
        </div>

        <div class="rounded-xl border bg-card p-8 shadow-sm">
          <Stepper current={step()} />

          <div class="mb-6">
            <h2 class="text-lg font-semibold text-foreground">{t(current().titleKey)}</h2>
            <p class="text-sm text-muted-foreground mt-0.5">{t(current().subtitleKey)}</p>
          </div>

          <Show when={step() === 1}>
            <StepAccount data={account()} onChange={setAccount} onDone={next} />
          </Show>
          <Show when={step() === 2}>
            <StepRemoteControl onDone={next} onBack={prev} />
          </Show>
          <Show when={step() === 3}>
            <StepConnection data={connection()} onChange={setConnection} onFinish={handleFinish} onBack={prev} />
          </Show>
        </div>
      </div>
    </div>
  );
};

export default Setup;
