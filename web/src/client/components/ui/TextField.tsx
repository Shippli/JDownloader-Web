import type { Component, JSX } from 'solid-js';
import * as KobalteTextField from '@kobalte/core/text-field';
import { splitProps } from 'solid-js';
import { cx } from '../../lib/cva';
import { inputClass } from './Input';

type TextFieldProps = Omit<KobalteTextField.TextFieldRootProps, 'class'> & {
  label?: string;
  description?: string;
  error?: string;
  class?: string;
  inputClass?: string;
  placeholder?: string;
  type?: string;
  inputProps?: JSX.InputHTMLAttributes<HTMLInputElement> & { 'data-autofocus'?: string };
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
    <div class={cx('flex flex-col gap-1', local.class)}>
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
          class={cx(
            inputClass,
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
          <KobalteTextField.ErrorMessage class="text-xs text-destructive">
            {local.error}
          </KobalteTextField.ErrorMessage>
        )}
      </KobalteTextField.Root>
    </div>
  );
};
