import type { Component, JSX } from 'solid-js';
import * as KobalteTextField from '@kobalte/core/text-field';
import { splitProps } from 'solid-js';
import { cn } from '../../lib/cn';

type TextFieldProps = Omit<KobalteTextField.TextFieldRootProps, 'class'> & {
  label?: string;
  description?: string;
  error?: string;
  class?: string;
  inputClass?: string;
  placeholder?: string;
  type?: string;
  inputProps?: JSX.InputHTMLAttributes<HTMLInputElement>;
};

export const TextField: Component<TextFieldProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'label',
    'description',
    'error',
    'class',
    'inputClass',
    'placeholder',
    'type',
    'inputProps',
  ]);
  return (
    <div class={cn('flex flex-col gap-1', local.class)}>
      <KobalteTextField.Root
        validationState={local.error ? 'invalid' : 'valid'}
        {...rest}
      >
        {local.label && (
          <KobalteTextField.Label class="text-sm font-medium text-foreground">
            {local.label}
          </KobalteTextField.Label>
        )}
        <KobalteTextField.Input
          type={local.type}
          placeholder={local.placeholder}
          class={cn(
            'w-full px-3 py-2 rounded-lg border bg-[hsl(var(--input))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed',
            local.error && 'border-destructive focus:ring-destructive',
            local.inputClass,
          )}
          {...(local.inputProps as any)}
        />
        {local.description && !local.error && (
          <KobalteTextField.Description class="text-xs text-muted-foreground">
            {local.description}
          </KobalteTextField.Description>
        )}
        {local.error && (
          <KobalteTextField.ErrorMessage class="text-xs text-red-600 dark:text-red-400">
            {local.error}
          </KobalteTextField.ErrorMessage>
        )}
      </KobalteTextField.Root>
    </div>
  );
};
