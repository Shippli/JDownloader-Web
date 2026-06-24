import { Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import { Toaster } from './components/ui/Toaster';
import { AppRoutes } from './routes';
import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import './app.css';

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
