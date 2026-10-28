import type { Component } from 'solid-js';

// Logo + app name above the login/setup cards.
export const BrandHeader: Component = () => (
  <div class="text-center mb-8">
    <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-4 shadow-lg">
      <span class="i-tabler-ghost-filled w-7 h-7 text-primary-foreground" />
    </div>
    <h1 class="text-2xl font-bold text-foreground">JDownloader</h1>
  </div>
);
