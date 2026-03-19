import { Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import { Toaster } from './components/ui/Toaster';
import { AppRoutes } from './routes';
import { startWs } from './stores/ws';
import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import './app.css';

startWs();

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
