import type { Component, JSX } from 'solid-js';
import { Tabs as KobalteTabs } from '@kobalte/core';
import { cn } from '../../lib/cn';

// Re-export root and content directly
export const TabsRoot = KobalteTabs.Root;
export const TabsContent = KobalteTabs.Content;

// Styled list container (adds border-bottom underline look)
type ListProps = { class?: string; children?: JSX.Element };
export const TabsList: Component<ListProps> = (props) => {
  return (
    <KobalteTabs.List
      class={cn('flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', props.class)}
    >
      {props.children}
    </KobalteTabs.List>
  );
};

// Styled trigger (underline variant matching current design)
type TriggerProps = {
  value: string;
  class?: string;
  children?: JSX.Element;
  disabled?: boolean;
};
export const TabsTrigger: Component<TriggerProps> = (props) => {
  return (
    <KobalteTabs.Trigger
      value={props.value}
      disabled={props.disabled}
      class={cn(
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer',
        'border-transparent text-muted-foreground hover:text-foreground',
        'data-[selected]:border-primary data-[selected]:text-foreground',
        props.class,
      )}
    >
      {props.children}
    </KobalteTabs.Trigger>
  );
};
