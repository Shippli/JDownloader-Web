import { Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import { Toaster } from './components/ui/Toaster';
import { AppRoutes } from './routes';
import { startSse } from './stores/sse';
import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import './app.css';

startSse();

render(
  () => (
    <>
      <Toaster />
      <Router>
        <AppRoutes />
      </Router>
    </>
  ),
  document.getElementById('root')!,
);
