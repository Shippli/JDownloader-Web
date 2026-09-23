import type { Component } from 'solid-js';
import * as KobalteNumberField from '@kobalte/core/number-field';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';

type NumberFieldProps = Omit<KobalteNumberField.NumberFieldRootProps, 'class'> & {
  label?: string;
  description?: string;
  error?: string;
  class?: string;
  inputClass?: string;
  placeholder?: string;
};

export const NumberField: Component<NumberFieldProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'label',
    'description',
    'error',
    'class',
    'inputClass',
    'placeholder',
  ]);
  return (
    <div class={cx('flex flex-col gap-1', local.class)}>
      <KobalteNumberField.Root
        formatOptions={{ useGrouping: false }}
        validationState={local.error ? 'invalid' : 'valid'}
        {...rest}
      >
        {local.label && (
          <KobalteNumberField.Label class="text-sm font-medium text-foreground">
            {local.label}
          </KobalteNumberField.Label>
        )}
        <div class="flex items-center rounded-lg border border-input bg-transparent dark:bg-input/30 focus-within:ring-2 focus-within:ring-ring/50 overflow-hidden">
          <KobalteNumberField.DecrementTrigger class="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer select-none">
            <span class="i-tabler-minus w-3.5 h-3.5" />
          </KobalteNumberField.DecrementTrigger>
          <KobalteNumberField.Input
            placeholder={local.placeholder}
            class={cx(
              'flex-1 min-w-0 px-2 py-2 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed',
              local.inputClass,
            )}
          />
          <KobalteNumberField.IncrementTrigger class="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer select-none">
            <span class="i-tabler-plus w-3.5 h-3.5" />
          </KobalteNumberField.IncrementTrigger>
        </div>
        {local.description && !local.error && (
          <KobalteNumberField.Description class="text-xs text-muted-foreground">
            {local.description}
          </KobalteNumberField.Description>
        )}
        {local.error && (
          <KobalteNumberField.ErrorMessage class="text-xs text-destructive">
            {local.error}
          </KobalteNumberField.ErrorMessage>
        )}
      </KobalteNumberField.Root>
    </div>
  );
};
