import { createSignal } from 'solid-js';

const [_active, _setActive] = createSignal<string | null>(null);

export const activePopupStore = {
  active: _active,
  open: (id: string) => _setActive(id),
  close: (id: string) => {
    if (_active() === id) {
      _setActive(null);
    }
  },
  closeAll: () => _setActive(null),
};
