import type { Component } from 'solid-js';
import { Route } from '@solidjs/router';
import { lazy, Show } from 'solid-js';
import { AppShell } from './components/AppShell';
import { Skeleton } from './components/ui/Skeleton';
import { authStore } from './stores/auth';

const Login = lazy(() => import('./pages/Login'));
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

export const AppRoutes: Component = () => (
  <>
    <Route path="/login" component={Login} />
    <Route path="/" component={() => <ProtectedLayout><Downloads /></ProtectedLayout>} />
    <Route path="/downloads" component={() => <ProtectedLayout><Downloads /></ProtectedLayout>} />
    <Route path="/grabber" component={() => <ProtectedLayout><Grabber /></ProtectedLayout>} />
    <Route path="/config" component={() => <ProtectedLayout><Config /></ProtectedLayout>} />
    <Route path="*" component={() => <ProtectedLayout><Downloads /></ProtectedLayout>} />
  </>
);
