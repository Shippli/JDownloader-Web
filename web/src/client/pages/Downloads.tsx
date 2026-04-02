import type { Component } from 'solid-js';
import type { ContextMenuItem } from '../components/ContextMenu';
import type { DownloadLink, DownloadPackage } from '../lib/api';
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import ContextMenu from '../components/ContextMenu';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { Dialog } from '../components/ui/Dialog';
import { InlineInput } from '../components/ui/Input';
import { ProgressBar } from '../components/ui/ProgressBar';
import { SkeletonList } from '../components/ui/Skeleton';
import { TextField } from '../components/ui/TextField';
import { t } from '../i18n';
import { formatBytes, formatEta, formatSpeed, jdApi } from '../lib/api';
import { getCached, setCached } from '../lib/pageCache';
import { compactViewStore } from '../stores/compactView';
import { jdStore } from '../stores/jd';
import { sendRefresh, wsConnected, wsDownloads } from '../stores/ws';

const Downloads: Component = () => {
  const packages = () => wsDownloads()?.packages ?? ((getCached('dl.packages') as DownloadPackage[] | undefined) ?? []);
  const links = () => wsDownloads()?.links ?? ((getCached('dl.links') as DownloadLink[] | undefined) ?? []);
  const state = () => wsDownloads()?.state ?? ((getCached('dl.state') as string | undefined) ?? 'IDLE');
  const speed = () => wsDownloads()?.speed ?? ((getCached('dl.speed') as number | undefined) ?? 0);
  const [loading, setLoading] = createSignal(getCached('dl.packages') == null);
  const [expandedPkgs, setExpandedPkgs] = createSignal<Set<number>>(new Set());
  const [selectedPkgs, setSelectedPkgs] = createSignal<Set<number>>(new Set());
  const [selectedLinks, setSelectedLinks] = createSignal<Set<number>>(new Set());
  const [error, setError] = createSignal('');
  const [lastPkgClicked, setLastPkgClicked] = createSignal<number | null>(null);
  const [lastLinkClicked, setLastLinkClicked] = createSignal<number | null>(null);
  const [editingPkgId, setEditingPkgId] = createSignal<number | null>(null);
  const [editingName, setEditingName] = createSignal('');
  const [renameModal, setRenameModal] = createSignal<{ uuid: number; name: string } | null>(null);
  const [renameValue, setRenameValue] = createSignal('');
  const [priorityModal, setPriorityModal] = createSignal<{ linkIds: number[]; pkgIds: number[] } | null>(null);
  const [ctxMenu, setCtxMenu] = createSignal<{ x: number; y: number; type: 'pkg' | 'link'; uuid: number; name: string; enabled: boolean; priority?: string; touch?: boolean } | null>(null);
  const getEnabled = (apiEnabled?: boolean) => apiEnabled ?? false;

  // Extraction progress: ETA from JD is in ms. We smooth it with an EMA (alpha=0.3)
  // to filter noise without a hard threshold switch. Progress = elapsed_s / (elapsed_s + smoothedEta_s).
  const ETA_ALPHA = 0.3;
  const extractStartMap = new Map<number, {
    startMs: number;
    smoothedEtaMs: number;
  }>();

  const isExtracting = (status: string) => {
    const s = status.toLowerCase();
    return s.includes('extracting');
  };

  const selectAll = () => {
    setSelectedPkgs(new Set(packages().map(p => p.uuid)));
  };

  const clearSelection = () => {
    setSelectedPkgs(new Set<number>());
    setSelectedLinks(new Set<number>());
    setLastPkgClicked(null);
    setLastLinkClicked(null);
  };

  const hasSelection = () => selectedPkgs().size > 0 || selectedLinks().size > 0;

  const fetchData = () => sendRefresh('downloads');

  const [deleteModal, setDeleteModal] = createSignal<{ linkIds: number[]; pkgIds: number[]; message: string } | null>(null);
  const [deleteWithFiles, setDeleteWithFiles] = createSignal(false);
  const openDeleteModal = (linkIds: number[], pkgIds: number[], message: string) => {
    setDeleteWithFiles(false);
    setDeleteModal({ linkIds, pkgIds, message });
  };
  const executeDelete = async () => {
    const dm = deleteModal();
    setDeleteModal(null);
    if (!dm) {
      return;
    }
    try {
      await jdApi.cleanupDownloads(dm.linkIds, dm.pkgIds, deleteWithFiles());
      clearSelection();
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const cancelEdit = () => {
    setEditingPkgId(null);
    setEditingName('');
  };
  const closeRenameModal = () => {
    setRenameModal(null);
    setRenameValue('');
  };
  const commitTouchRename = async () => {
    const rm = renameModal();
    const name = renameValue().trim();
    closeRenameModal();
    if (!rm || !name) {
      return;
    }
    try {
      await jdApi.renameDownloadPackage(rm.uuid, name);
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const commitDownloadRename = async () => {
    const id = editingPkgId();
    const name = editingName().trim();
    if (!id) {
      return;
    }
    cancelEdit();
    if (!name) {
      return;
    }
    try {
      await jdApi.renameDownloadPackage(id, name);
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  fetchData();
  // Re-request when WS opens (fetchData at mount is a no-op if WS wasn't ready yet)
  createEffect(() => {
    if (wsConnected()) {
      fetchData();
    }
  });
  createEffect(() => {
    const d = wsDownloads();
    if (d === null) {
      return;
    }
    for (const link of d.links) {
      if (isExtracting(link.status ?? '')) {
        const eta = link.eta ?? 0;
        if (!extractStartMap.has(link.uuid)) {
          extractStartMap.set(link.uuid, { startMs: Date.now(), smoothedEtaMs: eta > 0 ? eta : 0 });
        } else if (eta > 0) {
          const entry = extractStartMap.get(link.uuid)!;
          entry.smoothedEtaMs = entry.smoothedEtaMs === 0
            ? eta
            : ETA_ALPHA * eta + (1 - ETA_ALPHA) * entry.smoothedEtaMs;
        }
      } else {
        extractStartMap.delete(link.uuid);
      }
    }
    setCached('dl.packages', d.packages);
    setCached('dl.links', d.links);
    setCached('dl.state', d.state);
    setCached('dl.speed', d.speed);
    setLoading(false);
  });

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressMoved = false;
  let longPressTriggered = false;
  const startLongPress = (type: 'pkg' | 'link', uuid: number, name: string, enabled: boolean, priority?: string) => (e: TouchEvent) => {
    e.stopPropagation();
    longPressMoved = false;
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
      if (!longPressMoved) {
        longPressTriggered = true;
        navigator.vibrate?.(50);
        setCtxMenu({ x: 0, y: 0, type, uuid, name, enabled, priority, touch: true });
      }
      longPressTimer = null;
    }, 500);
  };
  const endLongPress = (e: TouchEvent) => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (longPressTriggered) {
      e.preventDefault();
      longPressTriggered = false;
    }
  };
  const moveLongPress = () => {
    longPressMoved = true;
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (ctxMenu()) {
        setCtxMenu(null);
      } else if (editingPkgId() !== null) {
        cancelEdit();
      } else {
        clearSelection();
      }
    } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      selectAll();
    } else if (e.key === 'ArrowRight' && selectedPkgs().size > 0 && editingPkgId() === null) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }
      e.preventDefault();
      setExpandedPkgs(prev => new Set([...prev, ...selectedPkgs()]));
    } else if (e.key === 'ArrowLeft' && selectedPkgs().size > 0 && editingPkgId() === null) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }
      e.preventDefault();
      setExpandedPkgs(prev => new Set([...prev].filter(id => !selectedPkgs().has(id))));
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && hasSelection() && editingPkgId() === null) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }
      e.preventDefault();
      openDeleteModal([...selectedLinks()], [...selectedPkgs()], t('downloads.confirm.removeSelected'));
    }
  };
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => {
    document.removeEventListener('keydown', onKeyDown);
  });

  const getPackageLinks = (pkgUUID: number) =>
    links().filter(l => l.packageUUID === pkgUUID);

  const getProgress = (loaded: number, total: number) => {
    if (!total || total <= 0) {
      return 0;
    }
    return Math.round((loaded / total) * 100);
  };

  const getProgressColor = (pkg: DownloadPackage): 'blue' | 'green' | 'yellow' | 'red' => {
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
  };

  const getExtractionProgress = (link: DownloadLink): number | null => {
    if (!isExtracting(link.status ?? '')) {
      return null;
    }
    const entry = extractStartMap.get(link.uuid);
    if (!entry || entry.smoothedEtaMs === 0) {
      return 0;
    }
    if ((link.eta ?? 0) <= 0) {
      return 99;
    }
    const elapsedS = (Date.now() - entry.startMs) / 1000;
    return Math.max(0, Math.min(99, Math.round((elapsedS / (elapsedS + entry.smoothedEtaMs / 1000)) * 100)));
  };

  const toggleExpand = (uuid: number) => {
    setExpandedPkgs((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  };

  const togglePkgSelect = (uuid: number, shiftKey: boolean) => {
    const pkgList = packages();
    const currentIndex = pkgList.findIndex(p => p.uuid === uuid);

    if (shiftKey && lastPkgClicked() !== null) {
      const lastIndex = pkgList.findIndex(p => p.uuid === lastPkgClicked());
      if (lastIndex !== -1) {
        const from = Math.min(lastIndex, currentIndex);
        const to = Math.max(lastIndex, currentIndex);
        const rangeUuids = pkgList.slice(from, to + 1).map(p => p.uuid);
        setSelectedPkgs((prev) => {
          const next = new Set(prev);
          rangeUuids.forEach(id => next.add(id));
          return next;
        });
        return;
      }
    }

    setLastPkgClicked(uuid);
    setSelectedPkgs((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
        const pkgLinks = getPackageLinks(uuid).map(l => l.uuid);
        setSelectedLinks((prev2) => {
          const n2 = new Set(prev2);
          pkgLinks.forEach(id => n2.delete(id));
          return n2;
        });
      } else {
        next.add(uuid);
      }
      return next;
    });
  };

  const toggleLinkSelect = (uuid: number, shiftKey: boolean) => {
    const allLinks = links();

    if (shiftKey && lastLinkClicked() !== null) {
      const currentIndex = allLinks.findIndex(l => l.uuid === uuid);
      const lastIndex = allLinks.findIndex(l => l.uuid === lastLinkClicked());
      if (lastIndex !== -1 && currentIndex !== -1) {
        const from = Math.min(lastIndex, currentIndex);
        const to = Math.max(lastIndex, currentIndex);
        const rangeUuids = allLinks.slice(from, to + 1).map(l => l.uuid);
        setSelectedLinks((prev) => {
          const next = new Set(prev);
          rangeUuids.forEach(id => next.add(id));
          return next;
        });
        return;
      }
    }

    setLastLinkClicked(uuid);
    setSelectedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  };

  const handleRemove = () => {
    if (!selectedPkgs().size && !selectedLinks().size) {
      return;
    }
    openDeleteModal([...selectedLinks()], [...selectedPkgs()], t('downloads.confirm.removeSelected'));
  };

  const handleForce = async () => {
    if (!selectedPkgs().size && !selectedLinks().size) {
      return;
    }
    try {
      await jdApi.forceDownload([...selectedLinks()], [...selectedPkgs()]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const ctxTitle = () => {
    const cm = ctxMenu();
    if (!cm) {
      return '';
    }
    const inSel = cm.type === 'pkg' ? selectedPkgs().has(cm.uuid) : selectedLinks().has(cm.uuid);
    if (inSel && hasSelection()) {
      const total = selectedPkgs().size + selectedLinks().size;
      return `${total} ${t('common.selected')}`;
    }
    return cm.name;
  };

  const ctxTarget = () => {
    const cm = ctxMenu();
    if (!cm) {
      return { linkIds: [] as number[], pkgIds: [] as number[] };
    }
    const inSel = cm.type === 'pkg' ? selectedPkgs().has(cm.uuid) : selectedLinks().has(cm.uuid);
    if (inSel && hasSelection()) {
      return { linkIds: [...selectedLinks()], pkgIds: [...selectedPkgs()] };
    }
    return cm.type === 'pkg' ? { linkIds: [], pkgIds: [cm.uuid] } : { linkIds: [cm.uuid], pkgIds: [] };
  };

  const buildCtxItems = (): ContextMenuItem[] => {
    const cm = ctxMenu();
    if (!cm) {
      return [];
    }
    const { type, uuid, enabled } = cm;
    const { linkIds, pkgIds } = ctxTarget();

    const items: ContextMenuItem[] = [];

    if (type === 'pkg' && pkgIds.length === 1 && linkIds.length === 0) {
      items.push({
        label: t('downloads.ctx.rename'),
        icon: 'i-tabler-pencil',
        onClick: () => {
          if (cm.touch) {
            setRenameModal({ uuid, name: cm.name });
            setRenameValue(cm.name);
          } else {
            setEditingPkgId(uuid);
            setEditingName(cm.name);
          }
        },
      });
    }

    items.push({
      label: t('downloads.ctx.delete'),
      icon: 'i-tabler-trash',
      danger: true,
      onClick: () => openDeleteModal(linkIds, pkgIds, t('downloads.confirm.delete')),
    });
    items.push({
      label: enabled ? t('common.disable') : t('common.enable'),
      icon: enabled ? 'i-tabler-player-pause' : 'i-tabler-player-play',
      onClick: async () => {
        const newEnabled = !enabled;
        await jdApi.enableDownloads(newEnabled, linkIds, pkgIds).catch(e => setError((e as Error).message));
        fetchData();
      },
    });
    items.push({
      label: t('common.priority.label'),
      icon: 'i-tabler-sort-ascending',
      ...(cm.touch
        ? { onClick: () => setPriorityModal({ linkIds, pkgIds }) }
        : { submenu: [
            { label: t('common.priority.highest'), icon: 'i-tabler-arrow-bar-up', onClick: async () => {
              await jdApi.setDownloadPriority('HIGHEST', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.higher'), icon: 'i-tabler-arrows-up', onClick: async () => {
              await jdApi.setDownloadPriority('HIGHER', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.high'), icon: 'i-tabler-arrow-up', onClick: async () => {
              await jdApi.setDownloadPriority('HIGH', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.default'), icon: 'i-tabler-minus', onClick: async () => {
              await jdApi.setDownloadPriority('DEFAULT', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.low'), icon: 'i-tabler-arrow-down', onClick: async () => {
              await jdApi.setDownloadPriority('LOW', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
          ] }
      ),
    });
    items.push({
      label: t('downloads.ctx.checkStatus'),
      icon: 'i-tabler-refresh',
      onClick: async () => {
        await jdApi.checkDownloadLinks(linkIds, pkgIds).catch(e => setError((e as Error).message));
        fetchData();
      },
    });

    // Downloads-specific
    items.push({
      label: type === 'pkg' ? t('downloads.ctx.resetPkg') : t('downloads.ctx.resetLink'),
      icon: 'i-tabler-eraser',
      separator: true,
      onClick: async () => {
        await jdApi.resetDownloads(linkIds, pkgIds).catch(e => setError((e as Error).message));
        fetchData();
      },
    });
    items.push({
      label: t('downloads.ctx.force'),
      icon: 'i-tabler-bolt',
      onClick: async () => {
        await jdApi.forceDownload(linkIds, pkgIds).catch(e => setError((e as Error).message));
        fetchData();
      },
    });
    const allFinished
      = pkgIds.every(id => packages().find(p => p.uuid === id)?.finished)
        && linkIds.every(id => links().find(l => l.uuid === id)?.finished);
    if (allFinished && (pkgIds.length > 0 || linkIds.length > 0)) {
      items.push({
        label: t('downloads.ctx.extract'),
        icon: 'i-tabler-file-zip',
        onClick: async () => {
          await jdApi.extractArchive(linkIds, pkgIds).catch(e => setError((e as Error).message));
        },
      });
    }

    return items;
  };

  const isRunning = () => state() === 'RUNNING';

  // True if any selected item is currently enabled (= should show Stop)
  const selectionIsActive = () => {
    const selPkgs = selectedPkgs();
    const selLinks = selectedLinks();
    return (
      packages().some(p => selPkgs.has(p.uuid) && p.enabled)
      || links().some(l => selLinks.has(l.uuid) && l.enabled)
    );
  };

  const handleTogglePlay = async () => {
    try {
      if (!hasSelection()) {
        if (isRunning()) {
          await jdApi.stop();
        } else {
          await jdApi.start();
        }
      } else {
        const enable = !selectionIsActive();
        await jdApi.enableDownloads(enable, [...selectedLinks()], [...selectedPkgs()]);
      }
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const shouldShowStop = () => hasSelection() ? selectionIsActive() : isRunning();

  const stateLabel = () => {
    const s = state();
    const labels: Record<string, string> = {
      RUNNING: t('downloads.state.running'),
      PAUSE: t('downloads.state.paused'),
      IDLE: t('downloads.state.idle'),
      STOPPED: t('downloads.state.stopped'),
      STOPPED_STATE: t('downloads.state.stopped'),
      NA: t('downloads.state.na'),
      RECONNECT_REQUESTED: t('downloads.state.reconnect'),
      WAIT_RECONNECT: t('downloads.state.waitReconnect'),
    };
    return labels[s] ?? s;
  };

  const stateIconClass = () => {
    const s = state();
    if (s === 'RUNNING') {
      return 'i-tabler-player-play-filled text-green-500';
    }
    if (s === 'PAUSE') {
      return 'i-tabler-player-pause-filled text-yellow-500';
    }
    if (s === 'STOPPED' || s === 'STOPPED_STATE') {
      return 'i-tabler-player-stop-filled text-gray-400';
    }
    return 'i-tabler-circle-dot text-gray-400';
  };

  onMount(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('main') && !target.closest('[data-list-card]')) {
        clearSelection();
      }
    };
    document.addEventListener('click', handler);
    onCleanup(() => document.removeEventListener('click', handler));
  });

  return (
    <div>
      {/* Header */}
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-foreground">{t('downloads.title')}</h1>
          <div class="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
            <span class={`${stateIconClass()} inline-block w-4 h-4 flex-shrink-0`} />
            <span>{stateLabel()}</span>
            <Show when={speed() > 0}>
              <span>·</span>
              <span class="text-blue-600 dark:text-blue-400 font-medium">{formatSpeed(speed())}</span>
            </Show>
          </div>
        </div>

        {/* Controller buttons */}
        <div class="flex items-center gap-2 flex-wrap">
          <Button variant="default" onClick={handleTogglePlay}>
            <Show
              when={shouldShowStop()}
              fallback={<span class="i-tabler-player-play w-4 h-4" />}
            >
              <span class="i-tabler-player-stop w-4 h-4" />
            </Show>
            <span class="hidden sm:inline">
              {shouldShowStop() ? t('downloads.toolbar.stop') : t('downloads.toolbar.start')}
            </span>
          </Button>
          <Show when={!hasSelection()}>
            <Button variant="secondary" onClick={() => jdApi.pause(state() !== 'PAUSE').then(fetchData)} title={t('downloads.toolbar.pause')}>
              <span class="i-tabler-player-pause w-4 h-4" />
              <span class="hidden sm:inline">{t('downloads.toolbar.pause')}</span>
            </Button>
          </Show>

          <Show when={hasSelection()}>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            <Button variant="secondary" onClick={handleForce}>
              <span class="i-tabler-bolt w-4 h-4" />
              <span class="hidden sm:inline">{t('downloads.toolbar.force')}</span>
            </Button>
            <Button variant="danger" onClick={handleRemove}>
              <span class="i-tabler-trash w-4 h-4" />
              <span class="hidden sm:inline">{t('downloads.toolbar.remove')}</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={clearSelection}>
              <span class="i-tabler-x w-4 h-4" />
            </Button>
          </Show>

          <Show when={!hasSelection() && packages().length > 0}>
            <Button variant="ghost" onClick={selectAll} class="text-sm">{t('common.selectAll')}</Button>
          </Show>
        </div>
      </div>

      <Show when={jdStore.connected() === false}>
        <div class="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 mb-4">
          <span class="i-tabler-plug-off w-5 h-5 flex-shrink-0" />
          <span class="text-sm">{t('downloads.jdUnavailable')}</span>
        </div>
      </Show>
      <Show when={error() && jdStore.connected() !== false}>
        <div class="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 mb-4">
          <span class="i-tabler-alert-circle w-5 h-5 flex-shrink-0" />
          <span class="text-sm">{error()}</span>
        </div>
      </Show>

      <Show when={loading()}>
        <SkeletonList rows={6} />
      </Show>

      <Show when={!loading() && packages().length === 0}>
        <div class="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <span class="i-tabler-inbox w-12 h-12 mb-3" />
          <p class="text-sm">{t('downloads.empty')}</p>
        </div>
      </Show>

      {/* Package list */}
      <Show
        when={compactViewStore.enabled()}
        fallback={(
          <div class="flex flex-col gap-3">
            <For each={packages()}>
              {(pkg) => {
                const pkgLinks = () => getPackageLinks(pkg.uuid);
                const progress = () => getProgress(pkg.bytesLoaded, pkg.bytesTotal);
                const isExpanded = () => expandedPkgs().has(pkg.uuid);
                const isSelected = () => selectedPkgs().has(pkg.uuid);

                return (
                  <Card
                    class="overflow-hidden transition-all"
                    selected={isSelected()}
                    data-list-card
                    onTouchStart={startLongPress('pkg', pkg.uuid, pkg.name, getEnabled(pkg.enabled), pkg.priority)}
                    onTouchEnd={endLongPress}
                    onTouchMove={moveLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (navigator.maxTouchPoints > 0) {
                        return;
                      }
                      setCtxMenu({ x: e.clientX, y: e.clientY, type: 'pkg', uuid: pkg.uuid, name: pkg.name, enabled: getEnabled(pkg.enabled), priority: pkg.priority });
                    }}
                  >
                    {/* Package header */}
                    <div
                      class="p-4 cursor-pointer select-none"
                      onClick={e => togglePkgSelect(pkg.uuid, e.shiftKey)}
                    >
                      <div class="flex items-center gap-3">
                        {/* Checkbox */}
                        <Checkbox checked={isSelected()} onChange={() => {}} size="md" class="pointer-events-none flex-shrink-0" />

                        {/* Info */}
                        <div class="flex-1 min-w-0" style={{ opacity: getEnabled(pkg.enabled) ? 1 : 0.4 }}>
                          <div class="flex items-start justify-between gap-2 flex-wrap">
                            <div class="flex-1 min-w-0">
                              <Show
                                when={editingPkgId() === pkg.uuid}
                                fallback={
                                  <p class="font-semibold text-foreground text-sm truncate" title={pkg.name}>{pkg.name}</p>
                                }
                              >
                                <InlineInput
                                  value={editingName()}
                                  onInput={e => setEditingName(e.currentTarget.value)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      commitDownloadRename();
                                    }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  onBlur={commitDownloadRename}
                                  ref={el => setTimeout(() => el?.focus(), 0)}
                                />
                              </Show>
                              <div class="flex items-center gap-3 mt-1 flex-wrap">
                                <StatusBadge status={pkg.status ?? ''} finished={pkg.finished} />
                                <PriorityBadge priority={pkg.priority} />
                                <span class="text-xs text-muted-foreground">
                                  {formatBytes(pkg.bytesLoaded)}
                                  {' '}
                                  /
                                  {formatBytes(pkg.bytesTotal)}
                                </span>
                                <Show when={pkg.speed > 0}>
                                  <span class="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    {formatSpeed(pkg.speed)}
                                  </span>
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

                            {/* Expand button */}
                            <Show when={pkg.childCount > 0}>
                              <Button
                                variant="ghost"
                                size="icon"
                                class="shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(pkg.uuid);
                                }}
                              >
                                <span class={`i-tabler-chevron-down w-4 h-4 transition-transform ${isExpanded() ? 'rotate-180' : ''}`} />
                              </Button>
                            </Show>
                          </div>

                          {/* Progress bar */}
                          <ProgressBar value={progress()} color={getProgressColor(pkg)} class="mt-2.5" />
                          <div class="flex justify-between mt-1">
                            <span class="text-xs text-muted-foreground">
                              {progress()}
                              %
                            </span>
                            <span class="text-xs text-muted-foreground">
                              {pkg.childCount}
                              {' '}
                              {t(pkg.childCount !== 1 ? 'downloads.files' : 'downloads.file')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Links (expanded) */}
                    <Show when={isExpanded() && pkgLinks().length > 0}>
                      <div class="border-t">
                        <For each={pkgLinks()}>
                          {(link) => {
                            const linkProgress = () => getProgress(link.bytesLoaded, link.bytesTotal);
                            const isLinkSelected = () => selectedLinks().has(link.uuid);

                            return (
                              <div
                                class={`px-4 py-3 border-b last:border-0 transition-colors cursor-pointer select-none ${
                                  isLinkSelected() ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-muted/50'
                                }`}
                                onClick={e => toggleLinkSelect(link.uuid, e.shiftKey)}
                                onTouchStart={startLongPress('link', link.uuid, link.name, getEnabled(link.enabled), link.priority)}
                                onTouchEnd={endLongPress}
                                onTouchMove={moveLongPress}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (navigator.maxTouchPoints > 0) {
                                    return;
                                  }
                                  setCtxMenu({ x: e.clientX, y: e.clientY, type: 'link', uuid: link.uuid, name: link.name, enabled: getEnabled(link.enabled), priority: link.priority });
                                }}
                              >
                                <div class="flex items-center gap-3 pl-8">
                                  {/* Link checkbox */}
                                  <Checkbox checked={isLinkSelected()} onChange={() => {}} class="pointer-events-none flex-shrink-0" />

                                  <div class="flex-1 min-w-0" style={{ opacity: getEnabled(link.enabled) ? 1 : 0.4 }}>
                                    <div class="flex items-start justify-between gap-2 flex-wrap">
                                      <p class="text-sm text-foreground truncate" title={link.name}>{link.name}</p>
                                      <div class="flex items-center gap-2 flex-shrink-0">
                                        <StatusBadge status={link.status ?? ''} finished={link.finished} />
                                      </div>
                                    </div>
                                    <div class="flex items-center gap-3 mt-0.5 flex-wrap">
                                      <PriorityBadge priority={link.priority} />
                                      <span class="text-xs text-muted-foreground">{link.host}</span>
                                      <span class="text-xs text-muted-foreground">
                                        {formatBytes(link.bytesLoaded)}
                                        {' '}
                                        /
                                        {formatBytes(link.bytesTotal)}
                                      </span>
                                      <Show when={link.speed > 0}>
                                        <span class="text-xs text-blue-500 font-medium">{formatSpeed(link.speed)}</span>
                                      </Show>
                                      {(() => {
                                        const exProg = getExtractionProgress(link);
                                        return (
                                          <Show when={exProg !== null}>
                                            <span class="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                                              <Show when={(link.eta ?? 0) > 0}>
                                                {formatEta(Math.round(link.eta / 1000))}
                                                {' · '}
                                              </Show>
                                              {exProg}
                                              %
                                            </span>
                                          </Show>
                                        );
                                      })()}
                                    </div>
                                    {(() => {
                                      const exProg = getExtractionProgress(link);
                                      return (
                                        <>
                                          {exProg !== null
                                            ? <ProgressBar value={exProg} color="yellow" class="mt-1.5" />
                                            : <ProgressBar value={linkProgress()} color={link.finished ? 'green' : 'blue'} class="mt-1.5" />}
                                        </>
                                      );
                                    })()}
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
        <div class="card overflow-hidden">
          <For each={packages()}>
            {(pkg, index) => {
              const pkgLinks = () => getPackageLinks(pkg.uuid);
              const progress = () => getProgress(pkg.bytesLoaded, pkg.bytesTotal);
              const isSelected = () => selectedPkgs().has(pkg.uuid);
              const isExpanded = () => expandedPkgs().has(pkg.uuid);
              const expandBg = () => index() % 2 === 0
                ? 'bg-blue-50/50 dark:bg-blue-950/20'
                : 'bg-background';

              return (
                <>
                  {/* Package row */}
                  <div
                    class={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer select-none transition-colors ${isSelected() ? 'bg-blue-50/50 dark:bg-blue-900/10' : isExpanded() ? expandBg() : 'bg-muted/40 hover:bg-muted/70'}`}
                    data-list-card
                    onClick={e => togglePkgSelect(pkg.uuid, e.shiftKey)}
                    onTouchStart={startLongPress('pkg', pkg.uuid, pkg.name, getEnabled(pkg.enabled), pkg.priority)}
                    onTouchEnd={endLongPress}
                    onTouchMove={moveLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (navigator.maxTouchPoints > 0) {
                        return;
                      }
                      setCtxMenu({ x: e.clientX, y: e.clientY, type: 'pkg', uuid: pkg.uuid, name: pkg.name, enabled: getEnabled(pkg.enabled), priority: pkg.priority });
                    }}
                  >
                    <Checkbox checked={isSelected()} onChange={() => {}} class="pointer-events-none flex-shrink-0" />
                    <Show
                      when={editingPkgId() === pkg.uuid}
                      fallback={<span class="text-xs font-semibold text-foreground truncate flex-1 min-w-0" style={{ opacity: getEnabled(pkg.enabled) ? 1 : 0.4 }}>{pkg.name}</span>}
                    >
                      <InlineInput
                        value={editingName()}
                        onInput={e => setEditingName(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitDownloadRename();
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                        onBlur={commitDownloadRename}
                        ref={el => setTimeout(() => el?.focus(), 0)}
                        class="flex-1 min-w-0 text-xs"
                      />
                    </Show>
                    <PriorityBadge priority={pkg.priority} iconOnly />
                    <StatusBadge status={pkg.status ?? ''} finished={pkg.finished} />
                    <Show when={pkg.speed > 0}>
                      <span class="text-xs text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">{formatSpeed(pkg.speed)}</span>
                    </Show>
                    <ProgressBar value={progress()} color={getProgressColor(pkg)} class="w-16 flex-shrink-0" />
                    <Show when={pkg.childCount > 0}>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="shrink-0 -mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(pkg.uuid);
                        }}
                      >
                        <span class={`i-tabler-chevron-down w-4 h-4 transition-transform ${isExpanded() ? 'rotate-180' : ''}`} />
                      </Button>
                    </Show>
                  </div>
                  {/* Link rows */}
                  <Show when={isExpanded()}>
                    {/* Package summary row */}
                    <div class={`flex border-b text-xs divide-x divide-border ${expandBg()}`}>
                      <Show when={pkg.status}>
                        <div class="flex flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 text-center min-w-0 overflow-hidden">
                          <span class="text-muted-foreground uppercase tracking-wide" style={{ 'font-size': '10px' }}>{t('downloads.summaryStatus')}</span>
                          <span class="text-foreground font-medium truncate max-w-full" title={pkg.status}>{pkg.status}</span>
                        </div>
                      </Show>
                      <div class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-center">
                        <span class="text-muted-foreground uppercase tracking-wide" style={{ 'font-size': '10px' }}>{t('downloads.summarySize')}</span>
                        <span class="text-foreground font-medium">
                          {formatBytes(pkg.bytesLoaded)}
                          {' / '}
                          {formatBytes(pkg.bytesTotal)}
                        </span>
                      </div>
                      <div class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-center">
                        <span class="text-muted-foreground uppercase tracking-wide" style={{ 'font-size': '10px' }}>{t('downloads.summaryFiles')}</span>
                        <span class="text-foreground font-medium">
                          {pkgLinks().filter(l => l.finished).length}
                          {' / '}
                          {pkgLinks().length}
                        </span>
                      </div>
                    </div>
                    <For each={pkgLinks()}>
                      {(link) => {
                        const linkProgress = () => getProgress(link.bytesLoaded, link.bytesTotal);
                        const isLinkSelected = () => selectedLinks().has(link.uuid);
                        const exProg = () => getExtractionProgress(link);

                        return (
                          <div
                            class={`flex items-center gap-2 px-3 py-1.5 pl-8 border-b last:border-b-0 cursor-pointer select-none transition-colors ${isLinkSelected() ? 'bg-blue-50/50 dark:bg-blue-900/10' : expandBg()}`}
                            data-list-card
                            onClick={e => toggleLinkSelect(link.uuid, e.shiftKey)}
                            onTouchStart={startLongPress('link', link.uuid, link.name, getEnabled(link.enabled), link.priority)}
                            onTouchEnd={endLongPress}
                            onTouchMove={moveLongPress}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (navigator.maxTouchPoints > 0) {
                                return;
                              }
                              setCtxMenu({ x: e.clientX, y: e.clientY, type: 'link', uuid: link.uuid, name: link.name, enabled: getEnabled(link.enabled), priority: link.priority });
                            }}
                          >
                            <Checkbox checked={isLinkSelected()} onChange={() => {}} class="pointer-events-none flex-shrink-0" />
                            <span class="text-xs text-foreground truncate flex-1 min-w-0" style={{ opacity: getEnabled(link.enabled) ? 1 : 0.4 }}>{link.name}</span>
                            <PriorityBadge priority={link.priority} iconOnly />
                            <StatusBadge status={link.status ?? ''} finished={link.finished} />
                            <span class="text-xs text-muted-foreground flex-shrink-0">{link.host}</span>
                            <ProgressBar
                              value={exProg() !== null ? exProg()! : linkProgress()}
                              color={exProg() !== null ? 'yellow' : link.finished ? 'green' : 'blue'}
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
        </div>
      </Show>
      {/* Context menu — desktop: positioned menu, touch: bottom sheet */}
      <Show when={ctxMenu()} keyed>
        {cm => <ContextMenu x={cm.x} y={cm.y} touch={cm.touch} title={ctxTitle()} items={buildCtxItems()} onClose={() => setCtxMenu(null)} />}
      </Show>
      {/* Delete confirmation modal */}
      <Dialog open={!!deleteModal()} onClose={() => setDeleteModal(null)} title={t('common.delete')}>
        <div class="px-6 py-4 space-y-4">
          <p class="text-sm text-foreground">{deleteModal()?.message}</p>
          <Checkbox
            checked={deleteWithFiles()}
            onChange={v => setDeleteWithFiles(v)}
            label={t('downloads.confirm.deleteWithFiles')}
          />
          <div class="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={executeDelete}>{t('common.delete')}</Button>
          </div>
        </div>
      </Dialog>
      {/* Priority modal */}
      <Dialog open={!!priorityModal()} onClose={() => setPriorityModal(null)} title={t('common.priority.label')}>
        <Show when={priorityModal()} keyed>
          {(pm) => {
            const setPriority = async (p: string) => {
              const { linkIds, pkgIds } = pm;
              setPriorityModal(null);
              await jdApi.setDownloadPriority(p, linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            };
            const priorities = [
              { key: 'HIGHEST', label: t('common.priority.highest'), icon: 'i-tabler-arrow-bar-up' },
              { key: 'HIGHER', label: t('common.priority.higher'), icon: 'i-tabler-arrows-up' },
              { key: 'HIGH', label: t('common.priority.high'), icon: 'i-tabler-arrow-up' },
              { key: 'DEFAULT', label: t('common.priority.default'), icon: 'i-tabler-minus' },
              { key: 'LOW', label: t('common.priority.low'), icon: 'i-tabler-arrow-down' },
            ] as const;
            return (
              <div class="py-2">
                <For each={priorities}>
                  {p => (
                    <button
                      class="flex items-center justify-center gap-3 w-full px-6 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                      onClick={() => setPriority(p.key)}
                    >
                      <span class={`${p.icon} w-4 h-4 text-muted-foreground`} />
                      {p.label}
                    </button>
                  )}
                </For>
              </div>
            );
          }}
        </Show>
      </Dialog>
      {/* Touch rename modal */}
      <Dialog open={!!renameModal()} onClose={closeRenameModal} title={t('downloads.renameModal.title')}>
        <div class="px-6 py-4 space-y-4">
          <TextField
            type="text"
            value={renameValue()}
            onChange={setRenameValue}
            inputProps={{
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTouchRename();
                }
              },
              ref: el => setTimeout(() => el?.focus(), 0),
            }}
          />
          <div class="flex gap-2 justify-end">
            <Button variant="secondary" onClick={closeRenameModal}>{t('common.cancel')}</Button>
            <Button variant="default" onClick={commitTouchRename}>{t('common.save')}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Downloads;
