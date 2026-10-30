import { Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import { Toaster } from './components/ui/Sonner';
import { AppRoutes } from './routes';
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
