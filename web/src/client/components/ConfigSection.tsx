import type { Component, JSX } from 'solid-js';

// Titled block within a config page.
export const ConfigSection: Component<{ title: string; children: JSX.Element }> = props => (
  <div>
    <h3 class="text-sm font-semibold text-foreground mb-3">{props.title}</h3>
    {props.children}
  </div>
);
