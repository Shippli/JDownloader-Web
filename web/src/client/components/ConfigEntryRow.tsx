import type { Component, JSX } from 'solid-js';
import type { ConfigEntry } from '../lib/api';
import { createEffect, createSignal, Show } from 'solid-js';
import { t, tf } from '../i18n';
import { configApi } from '../lib/api';
import { cx } from '../lib/cva';
import { FormActions } from './FormActions';
import { Button } from './ui/Button';
import { Checkbox } from './ui/Checkbox';
import { Select } from './ui/Select';
import { TextField } from './ui/TextField';

const NUMERIC_TYPES = new Set(['INT', 'LONG', 'DOUBLE', 'FLOAT']);

export function configTypeLabel(aType: string) {
  const map: Record<string, string> = {
    INT: 'Int',
    LONG: 'Long',
    DOUBLE: 'Double',
    FLOAT: 'Float',
    BOOLEAN: t('config.settings.typeBool'),
    STRING: t('config.settings.typeString'),
    ENUM: 'Enum',
    STRING_LIST: t('config.settings.typeList'),
  };
  return map[aType] ?? aType;
}

export const configEntryKey = (e: ConfigEntry) => `${e.interfaceName}::${e.key}`;

function isModified(entry: ConfigEntry) {
  return entry.value != null
    && entry.defaultValue != null
    && String(entry.value) !== String(entry.defaultValue);
}

// Converts the edited string back to the entry's JD type.
function coerceSettingValue(entry: ConfigEntry, raw: string): unknown {
  const aType = entry.abstractType;
  if (aType === 'BOOLEAN') {
    return raw === 'true';
  }
  if (aType === 'INT' || aType === 'LONG') {
    return Number.parseInt(raw);
  }
  if (aType === 'DOUBLE' || aType === 'FLOAT') {
    return Number.parseFloat(raw);
  }
  if (aType === 'STRING_LIST' || Array.isArray(entry.value) || Array.isArray(entry.defaultValue)) {
    return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return raw;
}

type ConfigEntryRowProps = {
  entry: ConfigEntry;
  // Badges/title line shown in view and edit mode.
  header: JSX.Element;
  class?: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  // Called after a successful save/reset (e.g. to reload entries).
  onSaved: () => unknown;
  onError: (message: string) => void;
};

export const ConfigEntryRow: Component<ConfigEntryRowProps> = (props) => {
  const [editValue, setEditValue] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const aType = () => props.entry.abstractType;
  const ref = () => ({ interfaceName: props.entry.interfaceName, storage: props.entry.storage, key: props.entry.key });

  createEffect(() => {
    if (props.editing) {
      setEditValue(String(props.entry.value ?? props.entry.defaultValue ?? ''));
    }
  });

  const persist = async (action: Promise<unknown>) => {
    setSaving(true);
    props.onError('');
    try {
      await action;
      props.onCancel();
      await props.onSaved();
    } catch (e) {
      props.onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class={cx('border-b last:border-0 px-4 py-3', props.class)}>
      <Show
        when={props.editing}
        fallback={(
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">{props.header}</div>
              <Show when={props.entry.docs}>
                <p class="text-xs text-muted-foreground mt-0.5">{props.entry.docs}</p>
              </Show>
              <p class={`text-sm mt-1 font-mono ${isModified(props.entry)
                ? 'text-warning font-semibold'
                : 'text-foreground'}`}
              >
                {String(props.entry.value ?? props.entry.defaultValue ?? '–')}
                <Show when={isModified(props.entry)}>
                  <span class="ml-2 text-xs font-sans font-normal text-warning opacity-70">
                    (
                    {tf('config.settings.defaultLabel', String(props.entry.defaultValue))}
                    )
                  </span>
                </Show>
              </p>
            </div>
            <Button variant="ghost" size="icon" class="shrink-0" onClick={() => props.onEdit()} title={t('config.settings.btnEdit')} icon="i-tabler-edit" />
          </div>
        )}
      >
        <div class="space-y-2">
          <div class="flex items-center gap-2 flex-wrap">{props.header}</div>
          <Show when={props.entry.docs}>
            <p class="text-xs text-muted-foreground">{props.entry.docs}</p>
          </Show>
          <Show
            when={aType() === 'BOOLEAN'}
            fallback={(
              <Show
                when={aType() === 'ENUM' && props.entry.enumOptions?.length}
                fallback={(
                  <TextField
                    type={NUMERIC_TYPES.has(aType())
                      ? 'number'
                      : 'text'}
                    value={editValue()}
                    onChange={setEditValue}
                  />
                )}
              >
                <Select
                  value={editValue()}
                  onChange={setEditValue}
                  options={(props.entry.enumOptions ?? []).map(([val, lbl]) => ({ value: val, label: lbl || val }))}
                />
              </Show>
            )}
          >
            <Checkbox
              checked={editValue() === 'true'}
              onChange={v => setEditValue(String(v))}
              label={t('config.settings.enabled')}
            />
          </Show>
          <FormActions
            saving={saving()}
            onSave={() => persist(configApi.setSetting({
              ...ref(),
              value: coerceSettingValue(props.entry, editValue()),
            }))}
            onCancel={props.onCancel}
          >
            <Button variant="secondary" onClick={() => persist(configApi.resetSetting(ref()))} disabled={saving()} title={t('config.settings.reset')} icon="i-tabler-restore">
              {t('config.settings.reset')}
            </Button>
          </FormActions>
        </div>
      </Show>
    </div>
  );
};
