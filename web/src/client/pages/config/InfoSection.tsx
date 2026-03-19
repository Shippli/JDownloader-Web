import type { Component } from 'solid-js';
import type { DownloadConfig, StorageInfo } from '../../lib/api';
import {

  createResource,
  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { NumberField } from '../../components/ui/NumberField';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { t } from '../../i18n';
import { configApi, formatBytes } from '../../lib/api';

const InfoSection: Component = () => {
  const [info, { refetch: refetchInfo }] = createResource(() => configApi.getInfo());
  const [conn, { refetch: refetchConn }] = createResource(() => configApi.getConnection());
  const [editingConn, setEditingConn] = createSignal(false);
  const [connHost, setConnHost] = createSignal('');
  const [connPort, setConnPort] = createSignal('');
  const [connSaving, setConnSaving] = createSignal(false);
  const [connError, setConnError] = createSignal('');

  const startEditConn = () => {
    setConnHost(conn()?.host ?? '');
    setConnPort(conn()?.port ?? '');
    setConnError('');
    setEditingConn(true);
  };

  const saveConn = async (e: Event) => {
    e.preventDefault();
    setConnSaving(true);
    setConnError('');
    try {
      await configApi.setConnection(connHost().trim(), connPort().trim());
      setEditingConn(false);
      refetchConn();
      refetchInfo();
    } catch (err) {
      setConnError((err as Error).message);
    } finally {
      setConnSaving(false);
    }
  };

  const formatUptime = (ms: number) => {
    if (!ms) {
      return '–';
    }
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const parts = [];
    if (d > 0) {
      parts.push(`${d}d`);
    }
    if (h > 0) {
      parts.push(`${h}h`);
    }
    if (m > 0) {
      parts.push(`${m}m`);
    }
    return parts.join(' ') || '<1m';
  };

  const jdRows = () => {
    const i = info();
    if (!i) {
      return [];
    }
    const s = i.systemInfos;
    const rows: { label: string; value: string; ok?: boolean }[] = [
      { label: t('config.info.status'), value: i.version != null ? t('config.info.connected') : t('config.info.unavailable'), ok: i.version != null },
      { label: t('config.info.version'), value: i.version ?? '–' },
      { label: t('config.info.revision'), value: i.revision != null ? String(i.revision) : '–' },
      { label: t('config.info.uptime'), value: i.uptime != null ? formatUptime(i.uptime) : '–' },
    ];
    if (s?.hardware) {
      rows.push({ label: t('config.info.hardware'), value: s.hardware });
    }
    if (s?.operatingSystem) {
      rows.push({ label: t('config.info.os'), value: s.operatingSystem });
    }
    return rows;
  };

  // ─── Download Config ───────────────────────────────────────────────────────
  const [dlConfig, setDlConfig] = createSignal<DownloadConfig | null>(null);
  const [editingRow, setEditingRow] = createSignal<string | null>(null);
  const [editNum, setEditNum] = createSignal('');
  const [editBool, setEditBool] = createSignal(false);
  const [dlSaving, setDlSaving] = createSignal(false);
  const [rowError, setRowError] = createSignal('');

  onMount(async () => {
    try {
      setDlConfig(await configApi.getDownloadConfig());
    } catch { /* jd unavailable */ }
  });

  const reloadDl = async () => {
    try {
      setDlConfig(await configApi.getDownloadConfig());
    } catch { /* ignore */ }
  };

  const startRow = (key: string, numVal?: number | null, boolVal?: boolean | null) => {
    setEditingRow(key);
    setEditNum(String(numVal ?? ''));
    setEditBool(boolVal ?? false);
    setRowError('');
  };

  const saveRow = async (e: Event, key: string, isNum: boolean, extra?: { boolKey: string }) => {
    e.preventDefault();
    setDlSaving(true);
    setRowError('');
    try {
      if (extra) {
        await Promise.all([
          configApi.setDownloadConfig(extra.boolKey, editBool()),
          configApi.setDownloadConfig(key, Number.parseInt(editNum())),
        ]);
      } else if (isNum) {
        const multiplier = key === 'DownloadSpeedLimit' ? 1024 : 1;
        await configApi.setDownloadConfig(key, Number.parseInt(editNum()) * multiplier);
      } else {
        await configApi.setDownloadConfig(key, editNum());
      }
      await reloadDl();
      setEditingRow(null);
    } catch (err) {
      setRowError((err as Error).message);
    } finally {
      setDlSaving(false);
    }
  };

  const speedLabel = () => {
    const v = dlConfig()?.DownloadSpeedLimit ?? 0;
    return v > 0 ? `${Math.round(v / 1024)} ${t('config.dlconfig.speedLimitUnit')}` : t('config.dlconfig.speedUnlimited');
  };

  const Row = (props: { rowKey: string; label: string; value: () => string; onEdit: () => void; editContent: () => any; onSave?: (e: Event) => void }) => (
    <div class="border-b last:border-0 px-4 py-3">
      <Show
        when={editingRow() === props.rowKey}
        fallback={(
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm text-muted-foreground">{props.label}</span>
            <div class="flex items-center gap-3">
              <span class="text-sm font-mono text-foreground">{props.value()}</span>
              <Button variant="ghost" size="icon" onClick={props.onEdit} title={t('config.info.btnEdit')}>
                <span class="i-tabler-edit w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      >
        <form onSubmit={e => props.onSave ? props.onSave(e) : saveRow(e, props.rowKey, true)} class="space-y-2">
          {props.editContent()}
          <Show when={rowError()}>
            <p class="text-xs text-red-500">{rowError()}</p>
          </Show>
          <div class="flex gap-2">
            <Button type="submit" variant="default" disabled={dlSaving()}>
              <Show when={dlSaving()} fallback={<span class="i-tabler-check w-4 h-4" />}>
                <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
              </Show>
              {t('config.dlconfig.save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditingRow(null)}>{t('config.dlconfig.cancel')}</Button>
          </div>
        </form>
      </Show>
    </div>
  );

  // ─── System Actions ────────────────────────────────────────────────────────
  const [sysBusy, setSysBusy] = createSignal<string | null>(null);
  const [systemError, setSystemError] = createSignal('');
  const [updateCheckDone, setUpdateCheckDone] = createSignal(false);

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    setSysBusy(key);
    setSystemError('');
    setUpdateCheckDone(false);
    try {
      await fn();
      if (key === 'updateCheck') {
        setUpdateCheckDone(true);
      }
    } catch (err) {
      setSystemError((err as Error).message);
    } finally {
      setSysBusy(null);
    }
  };

  const sysActions = () => [
    { key: 'updateCheck', label: t('config.system.runUpdateCheck'), icon: 'i-tabler-refresh', fn: () => configApi.runUpdateCheck() },
    { key: 'restart', label: t('config.system.restart'), icon: 'i-tabler-rotate-clockwise', fn: () => configApi.restartJD() },
    { key: 'restartUpdate', label: t('config.system.restartAndUpdate'), icon: 'i-tabler-refresh-dot', fn: () => configApi.restartAndUpdate() },
  ];

  // ─── Storage ───────────────────────────────────────────────────────────────
  const [storage, setStorage] = createSignal<StorageInfo[]>([]);

  onMount(async () => {
    try {
      const infos = await configApi.getStorageInfos();
      const seen = new Set<string>();
      const unique = (infos ?? []).filter((s) => {
        const key = `${s.size}:${s.free}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      setStorage(unique);
    } catch { /* jd unavailable */ }
  });

  return (
    <div class="space-y-6">
      {/* Connection Settings */}
      <div>
        <h3 class="text-sm font-semibold text-foreground mb-3">{t('config.info.connection')}</h3>
        <div class="card overflow-hidden">
          <Show
            when={!editingConn()}
            fallback={(
              <form onSubmit={saveConn} class="px-4 py-3 space-y-3">
                <Show when={connError()}>
                  <div class="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
                    <span class="i-tabler-alert-circle w-3.5 h-3.5" />
                    {connError()}
                  </div>
                </Show>
                <div class="grid grid-cols-[1fr_auto] gap-3">
                  <TextField label={t('config.info.host')} value={connHost()} onChange={setConnHost} required placeholder="0.0.0.0" />
                  <div class="w-24">
                    <NumberField label={t('config.info.port')} value={Number(connPort())} onChange={v => setConnPort(String(v))} required minValue={1} maxValue={65535} placeholder="3128" />
                  </div>
                </div>
                <div class="flex gap-2">
                  <Button type="submit" variant="default" disabled={connSaving()}>
                    <Show when={connSaving()} fallback={<span class="i-tabler-check w-4 h-4" />}>
                      <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
                    </Show>
                    {t('config.info.save')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingConn(false)}>{t('config.info.cancel')}</Button>
                </div>
              </form>
            )}
          >
            <div class="flex items-center justify-between px-4 py-3">
              <div>
                <p class="text-xs text-muted-foreground mb-0.5">{t('config.info.api')}</p>
                <Show
                  when={!conn.loading}
                  fallback={<span class="i-tabler-loader-2 animate-spin w-4 h-4 text-muted-foreground" />}
                >
                  <p class="text-sm font-mono text-foreground">
                    {conn()?.host}
                    :
                    {conn()?.port}
                  </p>
                </Show>
              </div>
              <Button variant="ghost" size="icon" onClick={startEditConn} title={t('config.info.btnEdit')}>
                <span class="i-tabler-edit w-4 h-4" />
              </Button>
            </div>
          </Show>
        </div>
      </div>

      {/* JD Info */}
      <div>
        <h3 class="text-sm font-semibold text-foreground mb-3">{t('config.info.jd')}</h3>
        <Show
          when={!info.loading}
          fallback={<SkeletonTable rows={3} />}
        >
          <Show
            when={jdRows().length > 0}
            fallback={(
              <div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <span class="i-tabler-plug-off w-8 h-8 mb-2" />
                <p class="text-sm">{t('config.info.noConnection')}</p>
              </div>
            )}
          >
            <div class="card overflow-hidden">
              <For each={jdRows()}>
                {row => (
                  <div class="flex items-center justify-between px-4 py-3 border-b last:border-0">
                    <span class="text-sm text-muted-foreground">{row.label}</span>
                    <Show
                      when={row.ok !== undefined}
                      fallback={<span class="text-sm font-mono text-foreground">{row.value}</span>}
                    >
                      <span class={`flex items-center gap-1.5 text-sm font-medium ${row.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        <span class={`${row.ok ? 'i-tabler-circle-check' : 'i-tabler-circle-x'} w-4 h-4`} />
                        {row.value}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Storage */}
      <Show when={storage().length > 0}>
        <div>
          <h3 class="text-sm font-semibold text-foreground mb-3">{t('config.storage.title')}</h3>
          <div class="card overflow-hidden">
            <For each={storage()}>
              {(s) => {
                const used = s.size - s.free;
                const pct = s.size > 0 ? Math.round((used / s.size) * 100) : 0;
                const barColor = pct > 90 ? 'red' : pct > 70 ? 'yellow' : 'blue';
                return (
                  <div class="px-4 py-3 border-b last:border-0">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-sm font-mono text-foreground truncate mr-4">{s.path}</span>
                      <div class="flex items-center gap-2 shrink-0">
                        <Show when={s.error}>
                          <span class="text-xs text-red-500">{s.error}</span>
                        </Show>
                        <span class="text-xs text-muted-foreground">
                          {formatBytes(s.free)}
                          {' '}
                          {t('config.storage.free')}
                          {' '}
                          {t('config.storage.of')}
                          {' '}
                          {formatBytes(s.size)}
                        </span>
                      </div>
                    </div>
                    <ProgressBar value={pct} color={barColor as 'red' | 'yellow' | 'blue'} />
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Download Settings */}
      <div>
        <h3 class="text-sm font-semibold text-foreground mb-3">{t('config.dlconfig.title')}</h3>
        <Show when={dlConfig()} fallback={<SkeletonTable rows={4} />}>
          <div class="card overflow-hidden">
            <Row
              rowKey="MaxChunksPerFile"
              label={t('config.dlconfig.maxChunks')}
              value={() => String(dlConfig()?.MaxChunksPerFile ?? '–')}
              onEdit={() => startRow('MaxChunksPerFile', dlConfig()?.MaxChunksPerFile)}
              editContent={() => <NumberField value={editNum()} onChange={setEditNum} minValue={1} maxValue={20} />}
            />
            <Row
              rowKey="MaxSimultaneDownloads"
              label={t('config.dlconfig.maxParallel')}
              value={() => String(dlConfig()?.MaxSimultaneDownloads ?? '–')}
              onEdit={() => startRow('MaxSimultaneDownloads', dlConfig()?.MaxSimultaneDownloads)}
              editContent={() => <NumberField value={editNum()} onChange={setEditNum} minValue={1} maxValue={20} />}
            />
            <Row
              rowKey="MaxPerHost"
              label={t('config.dlconfig.maxPerHost')}
              value={() => dlConfig()?.MaxDownloadsPerHostEnabled ? String(dlConfig()?.MaxSimultaneDownloadsPerHost ?? '–') : t('common.disabled')}
              onEdit={() => startRow('MaxPerHost', dlConfig()?.MaxSimultaneDownloadsPerHost, dlConfig()?.MaxDownloadsPerHostEnabled)}
              onSave={e => saveRow(e, 'MaxSimultaneDownloadsPerHost', true, { boolKey: 'MaxDownloadsPerHostEnabled' })}
              editContent={() => (
                <div class="space-y-2">
                  <Checkbox
                    checked={editBool()}
                    onChange={v => setEditBool(v)}
                    label={t('config.dlconfig.maxPerHostEnabled')}
                  />
                  <Show when={editBool()}>
                    <NumberField value={editNum()} onChange={setEditNum} minValue={1} maxValue={20} />
                  </Show>
                </div>
              )}
            />
            <Row
              rowKey="DefaultDownloadFolder"
              label={t('config.dlconfig.downloadFolder')}
              value={() => dlConfig()?.DefaultDownloadFolder ?? '–'}
              onEdit={() => {
                setEditingRow('DefaultDownloadFolder');
                setEditNum(dlConfig()?.DefaultDownloadFolder ?? '');
                setRowError('');
              }}
              onSave={e => saveRow(e, 'DefaultDownloadFolder', false)}
              editContent={() => (
                <TextField value={editNum()} onChange={setEditNum} inputClass="font-mono" placeholder="/path/to/downloads" />
              )}
            />
            <Row
              rowKey="DownloadSpeedLimit"
              label={t('config.dlconfig.speedLimit')}
              value={speedLabel}
              onEdit={() => startRow('DownloadSpeedLimit', Math.round((dlConfig()?.DownloadSpeedLimit ?? 0) / 1024))}
              editContent={() => (
                <div class="flex items-center gap-2">
                  <NumberField value={editNum()} onChange={setEditNum} minValue={0} />
                  <span class="text-sm text-muted-foreground shrink-0">
                    {t('config.dlconfig.speedLimitUnit')}
                    {' '}
                    (0 =
                    {' '}
                    {t('config.dlconfig.speedUnlimited')}
                    )
                  </span>
                </div>
              )}
            />
          </div>
        </Show>
      </div>

      {/* System */}
      <div>
        <h3 class="text-sm font-semibold text-foreground mb-3">{t('config.system.title')}</h3>
        <div class="card overflow-hidden">
          <For each={sysActions()}>
            {action => (
              <div class="flex items-center justify-between px-4 py-3 border-b last:border-0">
                <div class="flex items-center gap-2">
                  <span class={`${action.icon} w-4 h-4 text-muted-foreground`} />
                  <span class="text-sm text-foreground">{action.label}</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => runAction(action.key, action.fn)}
                  disabled={sysBusy() !== null}
                >
                  <Show when={sysBusy() === action.key} fallback={<span class={`${action.icon} w-4 h-4`} />}>
                    <span class="i-tabler-loader-2 animate-spin w-4 h-4" />
                  </Show>
                  {t('config.system.run')}
                </Button>
              </div>
            )}
          </For>
          <Show when={systemError()}>
            <div class="px-4 py-2 text-xs text-red-500">{systemError()}</div>
          </Show>
          <Show when={updateCheckDone()}>
            <div class="px-4 py-2 text-xs text-green-600 dark:text-green-400">{t('config.system.updateCheckDone')}</div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default InfoSection;
