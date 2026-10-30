import type { Component } from 'solid-js';
import type { ContextMenuItem } from '../components/ContextMenu';
import type { DownloadLink, DownloadPackage } from '../lib/api';
import type { CtxMenuState, Selection } from '../lib/packageList';
import type { Priority } from '../lib/priority';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import ContextMenu from '../components/ContextMenu';
import { ExpandButton, ListAlerts, SelectionControls } from '../components/PackageListParts';
import PriorityBadge from '../components/PriorityBadge';
import { PriorityDialog } from '../components/PriorityDialog';
import { ScrollText } from '../components/ScrollText';
import StatusBadge from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PromptDialog } from '../components/ui/PromptDialog';
import { SkeletonList } from '../components/ui/Skeleton';
import { t } from '../i18n';
import { formatBytes, formatEta, formatSpeed, jdApi } from '../lib/api';
import { createPackageList } from '../lib/packageList';
import { priorityMenuItem } from '../lib/priority';
import { compactViewStore } from '../stores/compactView';
import { sseDownloads } from '../stores/sse';

type ProgressColor = 'blue' | 'green' | 'yellow' | 'red';

const STATE_ICON: Record<string, string> = {
  RUNNING: 'i-tabler-player-play-filled text-success',
  PAUSE: 'i-tabler-player-pause-filled text-warning',
  STOPPED: 'i-tabler-player-stop-filled text-muted-foreground',
  STOPPED_STATE: 'i-tabler-player-stop-filled text-muted-foreground',
};

const STATE_LABEL_KEY: Record<string, string> = {
  RUNNING: 'downloads.state.running',
  PAUSE: 'downloads.state.paused',
  IDLE: 'downloads.state.idle',
  STOPPED: 'downloads.state.stopped',
  STOPPED_STATE: 'downloads.state.stopped',
  NA: 'downloads.state.na',
  RECONNECT_REQUESTED: 'downloads.state.reconnect',
  WAIT_RECONNECT: 'downloads.state.waitReconnect',
};

const isExtracting = (status?: string) => (status ?? '').toLowerCase().includes('extracting');

function getProgress(loaded: number, total: number) {
  return total > 0
    ? Math.round((loaded / total) * 100)
    : 0;
}

function packageProgressColor(pkg: DownloadPackage): ProgressColor {
  if (pkg.finished) {
    return 'green';
  }
  const s = (pkg.status ?? '').toLowerCase();
  if (s.includes('error')) {
    return 'red';
  }
  if (s.includes('wait')) {
    return 'yellow';
  }
  return 'blue';
}

// JD reports the package as "Finished" while its links are still extracting.
function packageStatus(pkg: DownloadPackage, pkgLinks: DownloadLink[], extracting: boolean): string {
  if (!extracting) {
    return pkg.status ?? '';
  }
  return pkgLinks.find(l => isExtracting(l.status))?.status ?? 'Extracting';
}

const linkProgressColor = (link: DownloadLink): ProgressColor => link.finished ? 'green' : 'blue';

// Shows the *currently* extracting archive's own progress (0→100), resetting
// per file. When one file finishes and the next hasn't started yet, JD reports
// no "extracting" link for a moment — hold the last value (yellow ~100%) for a
// short grace period so the bar doesn't flicker back to the green download bar
// between files.
const EXTRACT_GRACE_MS = 3000;

function createExtractionHold() {
  // pkgUUID → last seen %. Plain map (non-reactive); holdTick drives
  // re-evaluation for the grace-expiry flip to green.
  const hold = new Map<number, { pct: number; lastSeenMs: number }>();
  const [holdTick, setHoldTick] = createSignal(0);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const armTimer = () => {
    if (timer !== null || hold.size === 0) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      const now = Date.now();
      for (const [uuid, h] of hold) {
        if (now - h.lastSeenMs >= EXTRACT_GRACE_MS) {
          hold.delete(uuid);
        }
      }
      setHoldTick(n => n + 1);
      armTimer(); // re-arm while any hold is still live
    }, EXTRACT_GRACE_MS + 250);
  };
  // Record every actively-extracting link on each store update. The exProgress
  // ticker stops once no link extracts, so the grace flip relies on armTimer.
  createEffect(() => {
    const d = sseDownloads();
    if (d === null) {
      return;
    }
    const now = Date.now();
    for (const l of d.links) {
      if (isExtracting(l.status)) {
        hold.set(l.packageUUID, { pct: d.exProgress[l.uuid] ?? 0, lastSeenMs: now });
      }
    }
    armTimer();
  });
  onCleanup(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });

  // Read inside JSX (tracked scope).
  // eslint-disable-next-line solid/reactivity
  return (pkgUUID: number, pkgLinks: DownloadLink[]): number | null => {
    holdTick();
    const ex = sseDownloads()?.exProgress ?? {};
    const extractingLink = pkgLinks.find(l => isExtracting(l.status));
    if (extractingLink) {
      return ex[extractingLink.uuid] ?? hold.get(pkgUUID)?.pct ?? 0;
    }
    const held = hold.get(pkgUUID);
    if (held && Date.now() - held.lastSeenMs < EXTRACT_GRACE_MS) {
      return held.pct;
    }
    return null;
  };
}

const Downloads: Component = () => {
  const packages = () => sseDownloads()?.packages ?? [];
  const links = () => sseDownloads()?.links ?? [];
  const state = () => sseDownloads()?.state ?? 'IDLE';
  const speed = () => sseDownloads()?.speed ?? 0;
  const loading = () => sseDownloads() === null;
  const isRunning = () => state() === 'RUNNING';

  const [error, setError] = createSignal('');
  const run = (p: Promise<unknown>) => p.catch(e => setError((e as Error).message));

  const [deleteModal, setDeleteModal] = createSignal<Selection & { message: string } | null>(null);
  const [deleteWithFiles, setDeleteWithFiles] = createSignal(false);
  const [renameModal, setRenameModal] = createSignal<{ uuid: number; name: string } | null>(null);
  const [priorityModal, setPriorityModal] = createSignal<Selection | null>(null);

  const openDeleteModal = (sel: Selection, message: string) => {
    setDeleteWithFiles(false);
    setDeleteModal({ ...sel, message });
  };

  const list = createPackageList({
    packages,
    links,
    sortKey: 'dl.sort',
    onDeleteSelection: sel => openDeleteModal(sel, t('downloads.confirm.removeSelected')),
  });

  const executeDelete = async () => {
    const dm = deleteModal();
    setDeleteModal(null);
    if (dm) {
      await run(jdApi.cleanupDownloads(dm.linkIds, dm.pkgIds, deleteWithFiles()).then(list.clearSelection));
    }
  };

  const extractValue = createExtractionHold();
  const linkExtractValue = (link: DownloadLink): number | null =>
    isExtracting(link.status)
      ? sseDownloads()?.exProgress[link.uuid] ?? 0
      : null;

  const buildCtxItems = (cm: CtxMenuState): ContextMenuItem[] => {
    const target = list.ctxTarget(cm);
    const { linkIds, pkgIds } = target;
    const setPriority = (p: Priority) => run(jdApi.setDownloadPriority(p, linkIds, pkgIds));
    const items: ContextMenuItem[] = [];

    if (cm.type === 'pkg' && pkgIds.length === 1 && linkIds.length === 0) {
      items.push({
        label: t('downloads.ctx.rename'),
        icon: 'i-tabler-pencil',
        onClick: () => setRenameModal({ uuid: cm.uuid, name: cm.name }),
      });
    }
    items.push(
      {
        label: t('downloads.ctx.delete'),
        icon: 'i-tabler-trash',
        danger: true,
        onClick: () => openDeleteModal(target, t('downloads.confirm.delete')),
      },
      {
        label: cm.enabled
          ? t('common.disable')
          : t('common.enable'),
        icon: cm.enabled ? 'i-tabler-player-pause' : 'i-tabler-player-play',
        onClick: () => run(jdApi.enableDownloads(!cm.enabled, linkIds, pkgIds)),
      },
      priorityMenuItem(cm.touch, () => setPriorityModal(target), setPriority),
      {
        label: t('downloads.ctx.checkStatus'),
        icon: 'i-tabler-refresh',
        onClick: () => run(jdApi.checkDownloadLinks(linkIds, pkgIds)),
      },
      {
        label: cm.type === 'pkg'
          ? t('downloads.ctx.resetPkg')
          : t('downloads.ctx.resetLink'),
        icon: 'i-tabler-eraser',
        separator: true,
        onClick: () => run(jdApi.resetDownloads(linkIds, pkgIds)),
      },
      {
        label: t('downloads.ctx.force'),
        icon: 'i-tabler-bolt',
        onClick: () => run(jdApi.forceDownload(linkIds, pkgIds)),
      },
    );
    const allFinished
      = pkgIds.every(id => packages().find(p => p.uuid === id)?.finished)
        && linkIds.every(id => links().find(l => l.uuid === id)?.finished);
    if (allFinished && (pkgIds.length > 0 || linkIds.length > 0)) {
      items.push({
        label: t('downloads.ctx.extract'),
        icon: 'i-tabler-file-zip',
        onClick: () => run(jdApi.extractArchive(linkIds, pkgIds)),
      });
    }
    return items;
  };

  const handleTogglePlay = () => run(isRunning()
    ? jdApi.stop()
    : jdApi.start());

  const handleForce = () => {
    const { linkIds, pkgIds } = list.selection();
    return run(jdApi.forceDownload(linkIds, pkgIds));
  };

  return (
    <div>
      {/* Header */}
      <div class="flex items-center justify-between gap-3 mb-6">
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold tracking-tight text-foreground truncate">{t('downloads.title')}</h1>
          <div class="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground overflow-hidden">
            <span class={`${STATE_ICON[state()] ?? 'i-tabler-circle-dot text-muted-foreground'} inline-block w-4 h-4 flex-shrink-0`} />
            <span class="hidden sm:inline truncate">
              {STATE_LABEL_KEY[state()]
                ? t(STATE_LABEL_KEY[state()])
                : state()}
            </span>
            <Show when={speed() > 0}>
              <span class="hidden sm:inline">·</span>
              <span class="text-muted-foreground font-medium flex-shrink-0">{formatSpeed(speed())}</span>
            </Show>
          </div>
        </div>

        {/* Controller buttons */}
        <div class="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="default"
            onClick={handleTogglePlay}
            icon={isRunning()
              ? 'i-tabler-player-stop'
              : 'i-tabler-player-play'}
          >
            <span class="hidden sm:inline">
              {isRunning()
                ? t('downloads.toolbar.stop')
                : t('downloads.toolbar.start')}
            </span>
          </Button>
          <Show when={!list.hasSelection()}>
            <Button variant="secondary" onClick={() => run(jdApi.pause(state() !== 'PAUSE'))} title={t('downloads.toolbar.pause')} icon="i-tabler-player-pause">
              <span class="hidden sm:inline">{t('downloads.toolbar.pause')}</span>
            </Button>
          </Show>

          <Show when={list.hasSelection()}>
            <div class="w-px h-6 bg-border" />
            <Button variant="secondary" onClick={handleForce} icon="i-tabler-bolt">
              <span class="hidden sm:inline">{t('downloads.toolbar.force')}</span>
            </Button>
            <Button variant="danger" onClick={() => openDeleteModal(list.selection(), t('downloads.confirm.removeSelected'))} icon="i-tabler-trash">
              <span class="hidden sm:inline">{t('downloads.toolbar.remove')}</span>
            </Button>
          </Show>

          <SelectionControls
            hasSelection={list.hasSelection()}
            hasItems={packages().length > 0}
            onClear={list.clearSelection}
            onSelectAll={list.selectAll}
            sort={list.sortState()}
            onSortChange={list.setSortState}
          />
        </div>
      </div>

      <ListAlerts unavailableText={t('downloads.jdUnavailable')} error={error()} />

      <Show when={loading()}>
        <SkeletonList rows={6} />
      </Show>

      <Show when={!loading() && packages().length === 0}>
        <EmptyState icon="i-tabler-inbox" text={t('downloads.empty')} />
      </Show>

      {/* Package list */}
      <Show
        when={compactViewStore.enabled()}
        fallback={(
          <div class="flex flex-col gap-3">
            <For each={list.sortedPackages()}>
              {(pkg) => {
                const pkgLinks = () => list.packageLinks(pkg.uuid);
                const progress = () => getProgress(pkg.bytesLoaded, pkg.bytesTotal);
                const pkgExProgress = () => extractValue(pkg.uuid, pkgLinks());
                const pkgStatus = () => packageStatus(pkg, pkgLinks(), pkgExProgress() !== null);

                return (
                  <Card
                    class="overflow-hidden transition-all"
                    selected={list.isPkgSelected(pkg.uuid)}
                    data-list-card
                    {...list.itemHandlers('pkg', pkg)}
                  >
                    {/* Package header */}
                    <div
                      class="p-4 cursor-pointer select-none"
                      onClick={e => list.togglePkgSelect(pkg.uuid, e.shiftKey)}
                    >
                      <div class="flex items-center gap-3">
                        <Checkbox checked={list.isPkgSelected(pkg.uuid)} onChange={() => {}} size="md" class="pointer-events-none flex-shrink-0" />

                        <div class="flex-1 min-w-0" classList={{ 'opacity-40': !pkg.enabled }}>
                          <div class="flex items-start justify-between gap-2 flex-wrap">
                            <div class="flex-1 min-w-0">
                              <ScrollText class="font-semibold text-foreground text-sm" title={pkg.name}>{pkg.name}</ScrollText>
                              <div class="flex items-center gap-3 mt-1 flex-wrap">
                                <StatusBadge status={pkgStatus()} />
                                <PriorityBadge priority={pkg.priority} />
                                <span class="text-xs text-muted-foreground">
                                  {formatBytes(pkg.bytesLoaded)}
                                  {' / '}
                                  {formatBytes(pkg.bytesTotal)}
                                </span>
                                <Show when={pkg.speed > 0}>
                                  <span class="text-xs text-muted-foreground font-medium">{formatSpeed(pkg.speed)}</span>
                                </Show>
                                <Show when={pkg.eta > 0}>
                                  <span class="text-xs text-muted-foreground">
                                    ETA:
                                    {formatEta(pkg.eta)}
                                  </span>
                                </Show>
                                <Show when={pkg.hosts?.length > 0}>
                                  <span class="text-xs text-muted-foreground">{pkg.hosts.join(', ')}</span>
                                </Show>
                              </div>
                            </div>

                            <Show when={pkg.childCount > 0}>
                              <ExpandButton expanded={list.isExpanded(pkg.uuid)} onToggle={() => list.toggleExpand(pkg.uuid)} />
                            </Show>
                          </div>

                          <ProgressBar
                            value={pkgExProgress() ?? progress()}
                            color={pkgExProgress() !== null
                              ? 'yellow'
                              : packageProgressColor(pkg)}
                            class="mt-2.5"
                          />
                          <div class="flex justify-between mt-1">
                            <span class="text-xs text-muted-foreground">
                              {progress()}
                              %
                            </span>
                            <span class="text-xs text-muted-foreground">
                              {pkg.childCount}
                              {' '}
                              {t(pkg.childCount !== 1
                                ? 'downloads.files'
                                : 'downloads.file')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Links (expanded) */}
                    <Show when={list.isExpanded(pkg.uuid) && pkgLinks().length > 0}>
                      <div class="border-t">
                        <For each={pkgLinks()}>
                          {(link) => {
                            const exProg = () => linkExtractValue(link);
                            const isLinkSelected = () => list.isLinkSelected(link.uuid);

                            return (
                              <div
                                class={`px-4 py-3 border-b last:border-0 transition-colors cursor-pointer select-none ${
                                  isLinkSelected()
                                    ? 'bg-info/5'
                                    : 'hover:bg-muted/50'
                                }`}
                                onClick={e => list.toggleLinkSelect(link.uuid, e.shiftKey)}
                                {...list.itemHandlers('link', link)}
                              >
                                <div class="flex items-center gap-3 pl-8">
                                  <Checkbox checked={isLinkSelected()} onChange={() => {}} class="pointer-events-none flex-shrink-0" />

                                  <div class="flex-1 min-w-0" classList={{ 'opacity-40': !link.enabled }}>
                                    <div class="flex items-start justify-between gap-2 flex-wrap">
                                      <ScrollText class="text-sm text-foreground" title={link.name}>{link.name}</ScrollText>
                                      <div class="flex items-center gap-2 flex-shrink-0">
                                        <StatusBadge status={link.status ?? ''} />
                                      </div>
                                    </div>
                                    <div class="flex items-center gap-3 mt-0.5 flex-wrap">
                                      <PriorityBadge priority={link.priority} />
                                      <span class="text-xs text-muted-foreground">{link.host}</span>
                                      <span class="text-xs text-muted-foreground">
                                        {formatBytes(link.bytesLoaded)}
                                        {' / '}
                                        {formatBytes(link.bytesTotal)}
                                      </span>
                                      <Show when={link.speed > 0}>
                                        <span class="text-xs text-muted-foreground font-medium">{formatSpeed(link.speed)}</span>
                                      </Show>
                                      <Show when={exProg() !== null}>
                                        <span class="text-xs text-warning font-medium">
                                          <Show when={(link.eta ?? 0) > 0}>
                                            {formatEta(Math.round(link.eta / 1000))}
                                            {' · '}
                                          </Show>
                                          {exProg()}
                                          %
                                        </span>
                                      </Show>
                                    </div>
                                    <ProgressBar
                                      value={exProg() ?? getProgress(link.bytesLoaded, link.bytesTotal)}
                                      color={exProg() !== null
                                        ? 'yellow'
                                        : linkProgressColor(link)}
                                      class="mt-1.5"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </Card>
                );
              }}
            </For>
          </div>
        )}
      >
        {/* Compact list */}
        <Card class="overflow-hidden">
          <For each={list.sortedPackages()}>
            {(pkg, index) => {
              const pkgLinks = () => list.packageLinks(pkg.uuid);
              const progress = () => getProgress(pkg.bytesLoaded, pkg.bytesTotal);
              const pkgExProgress = () => extractValue(pkg.uuid, pkgLinks());
              const pkgStatus = () => packageStatus(pkg, pkgLinks(), pkgExProgress() !== null);
              const isSelected = () => list.isPkgSelected(pkg.uuid);
              const isExpanded = () => list.isExpanded(pkg.uuid);
              const expandBg = () => index() % 2 === 0
                ? 'bg-info/5'
                : 'bg-background';

              return (
                <>
                  {/* Package row */}
                  <div
                    class={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer select-none transition-colors ${isSelected()
                      ? 'bg-info/5'
                      : isExpanded()
                        ? expandBg()
                        : 'bg-muted/40 hover:bg-muted/70'}`}
                    data-list-card
                    onClick={e => list.togglePkgSelect(pkg.uuid, e.shiftKey)}
                    {...list.itemHandlers('pkg', pkg)}
                  >
                    <Checkbox checked={isSelected()} onChange={() => {}} class="pointer-events-none flex-shrink-0" />
                    <ScrollText class="text-xs font-semibold text-foreground flex-1 min-w-0" classList={{ 'opacity-40': !pkg.enabled }}>{pkg.name}</ScrollText>
                    <PriorityBadge priority={pkg.priority} iconOnly />
                    <StatusBadge status={pkgStatus()} iconOnly />
                    <Show when={pkg.speed > 0}>
                      <span class="text-xs text-muted-foreground font-medium flex-shrink-0">{formatSpeed(pkg.speed)}</span>
                    </Show>
                    <ProgressBar
                      value={pkgExProgress() ?? progress()}
                      color={pkgExProgress() !== null
                        ? 'yellow'
                        : packageProgressColor(pkg)}
                      class="w-16 flex-shrink-0"
                    />
                    <Show when={pkg.childCount > 0}>
                      <ExpandButton expanded={isExpanded()} onToggle={() => list.toggleExpand(pkg.uuid)} class="shrink-0 -mr-1" />
                    </Show>
                  </div>
                  {/* Link rows */}
                  <Show when={isExpanded()}>
                    {/* Package summary row */}
                    <div class={`flex border-b text-xs divide-x divide-border ${expandBg()}`}>
                      <Show when={pkgStatus()}>
                        <div class="flex flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 text-center min-w-0 overflow-hidden">
                          <span class="text-muted-foreground uppercase tracking-wide text-2xs">{t('downloads.summaryStatus')}</span>
                          <span class="text-foreground font-medium truncate max-w-full" title={pkgStatus()}>{pkgStatus()}</span>
                        </div>
                      </Show>
                      <div class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-center">
                        <span class="text-muted-foreground uppercase tracking-wide text-2xs">{t('downloads.summarySize')}</span>
                        <span class="text-foreground font-medium">
                          {formatBytes(pkg.bytesLoaded)}
                          {' / '}
                          {formatBytes(pkg.bytesTotal)}
                        </span>
                      </div>
                      <div class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-center">
                        <span class="text-muted-foreground uppercase tracking-wide text-2xs">{t('downloads.summaryFiles')}</span>
                        <span class="text-foreground font-medium">
                          {pkgLinks().filter(l => l.finished).length}
                          {' / '}
                          {pkgLinks().length}
                        </span>
                      </div>
                    </div>
                    <For each={pkgLinks()}>
                      {(link) => {
                        const isLinkSelected = () => list.isLinkSelected(link.uuid);
                        const exProg = () => linkExtractValue(link);

                        return (
                          <div
                            class={`flex items-center gap-2 px-3 py-1.5 pl-8 border-b last:border-b-0 cursor-pointer select-none transition-colors ${isLinkSelected()
                              ? 'bg-info/5'
                              : expandBg()}`}
                            data-list-card
                            onClick={e => list.toggleLinkSelect(link.uuid, e.shiftKey)}
                            {...list.itemHandlers('link', link)}
                          >
                            <Checkbox checked={isLinkSelected()} onChange={() => {}} class="pointer-events-none flex-shrink-0" />
                            <ScrollText class="text-xs text-foreground flex-1 min-w-0" classList={{ 'opacity-40': !link.enabled }}>{link.name}</ScrollText>
                            <PriorityBadge priority={link.priority} iconOnly />
                            <StatusBadge status={link.status ?? ''} iconOnly />
                            <span class="text-xs text-muted-foreground flex-shrink-0">{link.host}</span>
                            <ProgressBar
                              value={exProg() ?? getProgress(link.bytesLoaded, link.bytesTotal)}
                              color={exProg() !== null
                                ? 'yellow'
                                : linkProgressColor(link)}
                              class="w-16 flex-shrink-0"
                            />
                          </div>
                        );
                      }}
                    </For>
                  </Show>
                </>
              );
            }}
          </For>
        </Card>
      </Show>

      {/* Context menu — desktop: positioned menu, touch: bottom sheet */}
      <Show when={list.ctxMenu()} keyed>
        {cm => <ContextMenu x={cm.x} y={cm.y} touch={cm.touch} title={list.ctxTitle(cm)} items={buildCtxItems(cm)} onClose={() => list.setCtxMenu(null)} />}
      </Show>
      <ConfirmDialog
        open={!!deleteModal()}
        title={t('common.delete')}
        message={deleteModal()?.message}
        confirmLabel={t('common.delete')}
        onConfirm={executeDelete}
        onClose={() => setDeleteModal(null)}
      >
        <Checkbox checked={deleteWithFiles()} onChange={setDeleteWithFiles} label={t('downloads.confirm.deleteWithFiles')} />
      </ConfirmDialog>
      <PriorityDialog
        open={!!priorityModal()}
        onClose={() => setPriorityModal(null)}
        onSelect={(p) => {
          const pm = priorityModal();
          if (pm) {
            run(jdApi.setDownloadPriority(p, pm.linkIds, pm.pkgIds));
          }
        }}
      />
      <PromptDialog
        open={!!renameModal()}
        title={t('downloads.renameModal.title')}
        initialValue={renameModal()?.name}
        onSubmit={name => run(jdApi.renameDownloadPackage(renameModal()!.uuid, name))}
        onClose={() => setRenameModal(null)}
      />
    </div>
  );
};

export default Downloads;
