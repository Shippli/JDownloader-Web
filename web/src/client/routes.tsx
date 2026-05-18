import type { Component } from 'solid-js';
import { Route, useNavigate } from '@solidjs/router';
import { lazy, onMount, Show } from 'solid-js';
import { AppShell } from './components/AppShell';
import { Skeleton } from './components/ui/Skeleton';
import { setupApi } from './lib/api';
import { authStore } from './stores/auth';

const Login = lazy(() => import('./pages/Login'));
const Setup = lazy(() => import('./pages/Setup'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Grabber = lazy(() => import('./pages/Grabber'));
const Config = lazy(() => import('./pages/Config'));

const ProtectedLayout: Component<{ children?: any }> = props => (
  <Show
    when={!authStore.loading()}
    fallback={(
      <div class="flex justify-center items-center h-full py-16">
        <Skeleton class="w-8 h-8 rounded-full" />
      </div>
    )}
  >
    <Show when={authStore.user()} fallback={<Login />}>
      <AppShell>{props.children}</AppShell>
    </Show>
  </Show>
);

const SetupGuard: Component = () => {
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const { setupComplete } = await setupApi.getStatus();
      if (setupComplete) {
        navigate('/downloads', { replace: true });
      }
    } catch {}
  });

  return <Setup />;
};

const AppGuard: Component<{ children?: any }> = (props) => {
  const navigate = useNavigate();

  onMount(async () => {
    try {
      const { setupComplete } = await setupApi.getStatus();
      if (!setupComplete) {
        navigate('/setup', { replace: true });
      }
    } catch {}
  });

  return <ProtectedLayout>{props.children}</ProtectedLayout>;
};

export const AppRoutes: Component = () => (
  <>
    <Route path="/login" component={() => <AppGuard><Login /></AppGuard>} />
    <Route path="/setup" component={SetupGuard} />
    <Route path="/" component={() => <AppGuard><Downloads /></AppGuard>} />
    <Route path="/downloads" component={() => <AppGuard><Downloads /></AppGuard>} />
    <Route path="/grabber" component={() => <AppGuard><Grabber /></AppGuard>} />
    <Route path="/config" component={() => <AppGuard><Config /></AppGuard>} />
    <Route path="*" component={() => <AppGuard><Downloads /></AppGuard>} />
  </>
);
