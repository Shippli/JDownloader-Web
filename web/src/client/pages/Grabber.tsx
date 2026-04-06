import type { Component } from 'solid-js';
import type { ContextMenuItem } from '../components/ContextMenu';
import type { GrabberLink, GrabberPackage } from '../lib/api';
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import AddLinksDialog from '../components/AddLinksDialog';
import ContextMenu from '../components/ContextMenu';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { Dialog } from '../components/ui/Dialog';
import { InlineInput } from '../components/ui/Input';
import { SkeletonList } from '../components/ui/Skeleton';
import { TextField } from '../components/ui/TextField';
import { t } from '../i18n';
import { formatBytes, jdApi } from '../lib/api';
import { getCached, setCached } from '../lib/pageCache';
import { compactViewStore } from '../stores/compactView';
import { jdStore } from '../stores/jd';
import { sendRefresh, wsConnected, wsGrabber } from '../stores/ws';

const Grabber: Component = () => {
  const packages = () => wsGrabber()?.packages ?? ((getCached('grabber.packages') as GrabberPackage[] | undefined) ?? []);
  const links = () => wsGrabber()?.links ?? ((getCached('grabber.links') as GrabberLink[] | undefined) ?? []);
  const [loading, setLoading] = createSignal(getCached('grabber.packages') == null);
  const [error, setError] = createSignal('');
  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [expandedPkgs, setExpandedPkgs] = createSignal<Set<number>>(new Set());
  const [selectedPkgs, setSelectedPkgs] = createSignal<Set<number>>(new Set());
  const [selectedLinks, setSelectedLinks] = createSignal<Set<number>>(new Set());
  const [lastPkgClicked, setLastPkgClicked] = createSignal<number | null>(null);
  const [lastLinkClicked, setLastLinkClicked] = createSignal<number | null>(null);
  const [editingPkgId, setEditingPkgId] = createSignal<number | null>(null);
  const [editingName, setEditingName] = createSignal('');
  const [renameModal, setRenameModal] = createSignal<{ uuid: number; name: string } | null>(null);
  const [renameValue, setRenameValue] = createSignal('');
  const [newPackageModal, setNewPackageModal] = createSignal<{ linkIds: number[]; pkgIds: number[] } | null>(null);
  const [newPackageName, setNewPackageName] = createSignal('');
  const [priorityModal, setPriorityModal] = createSignal<{ linkIds: number[]; pkgIds: number[] } | null>(null);
  const [ctxMenu, setCtxMenu] = createSignal<{ x: number; y: number; type: 'pkg' | 'link'; uuid: number; name: string; enabled: boolean; priority?: string; touch?: boolean } | null>(null);
  const getEnabled = (apiEnabled?: boolean) => apiEnabled ?? false;

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

  const fetchData = () => sendRefresh('grabber');

  fetchData();
  // Re-request when WS opens (fetchData at mount is a no-op if WS wasn't ready yet)
  createEffect(() => {
    if (wsConnected()) {
      fetchData();
    }
  });
  createEffect(() => {
    const d = wsGrabber();
    if (d === null) {
      return;
    }
    setCached('grabber.packages', d.packages);
    setCached('grabber.links', d.links);
    setLoading(false);
  });
  const [deleteModal, setDeleteModal] = createSignal<{ linkIds: number[]; pkgIds: number[]; message: string } | null>(null);
  const openDeleteModal = (linkIds: number[], pkgIds: number[], message: string) => setDeleteModal({ linkIds, pkgIds, message });
  const executeDelete = async () => {
    const dm = deleteModal();
    setDeleteModal(null);
    if (!dm) {
      return;
    }
    try {
      await jdApi.removeGrabber(dm.linkIds, dm.pkgIds);
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
  const closeNewPackageModal = () => {
    setNewPackageModal(null);
    setNewPackageName('');
  };
  const commitNewPackage = async () => {
    const npm = newPackageModal();
    const name = newPackageName().trim();
    closeNewPackageModal();
    if (!npm || !name) {
      return;
    }
    try {
      await jdApi.moveToNewPackage(npm.linkIds, npm.pkgIds, name);
      clearSelection();
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const commitTouchRename = async () => {
    const rm = renameModal();
    const name = renameValue().trim();
    closeRenameModal();
    if (!rm || !name) {
      return;
    }
    try {
      await jdApi.renameGrabberPackage(rm.uuid, name);
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
  };
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

  const commitEdit = async () => {
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
      await jdApi.renameGrabberPackage(id, name);
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
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
        label: t('grabber.ctx.rename'),
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
      label: t('grabber.ctx.delete'),
      icon: 'i-tabler-trash',
      danger: true,
      onClick: () => openDeleteModal(linkIds, pkgIds, t('grabber.confirm.delete')),
    });
    items.push({
      label: enabled ? t('common.disable') : t('common.enable'),
      icon: enabled ? 'i-tabler-player-pause' : 'i-tabler-player-play',
      onClick: async () => {
        const newEnabled = !enabled;
        await jdApi.enableGrabber(newEnabled, linkIds, pkgIds).catch(e => setError((e as Error).message));
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
              await jdApi.setGrabberPriority('HIGHEST', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.higher'), icon: 'i-tabler-arrows-up', onClick: async () => {
              await jdApi.setGrabberPriority('HIGHER', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.high'), icon: 'i-tabler-arrow-up', onClick: async () => {
              await jdApi.setGrabberPriority('HIGH', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.default'), icon: 'i-tabler-minus', onClick: async () => {
              await jdApi.setGrabberPriority('DEFAULT', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
            { label: t('common.priority.low'), icon: 'i-tabler-arrow-down', onClick: async () => {
              await jdApi.setGrabberPriority('LOW', linkIds, pkgIds).catch(e => setError((e as Error).message));
              fetchData();
            } },
          ] }
      ),
    });
    items.push({
      label: t('grabber.ctx.checkStatus'),
      icon: 'i-tabler-refresh',
      onClick: async () => {
        await jdApi.checkGrabberLinks(linkIds, pkgIds).catch(e => setError((e as Error).message));
        fetchData();
      },
    });

    // Grabber-specific
    items.push({
      label: t('grabber.ctx.newPackage'),
      icon: 'i-tabler-folder-plus',
      separator: true,
      onClick: () => {
        setNewPackageName(cm.name);
        setNewPackageModal({ linkIds, pkgIds });
      },
    });
    items.push({
      label: t('grabber.ctx.startDownload'),
      icon: 'i-tabler-player-play',
      onClick: async () => {
        await jdApi.moveToDownloads(linkIds, pkgIds).catch(e => setError((e as Error).message));
        await jdApi.start().catch(() => {});
        clearSelection();
        fetchData();
      },
    });

    return items;
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
      openDeleteModal([...selectedLinks()], [...selectedPkgs()], t('grabber.confirm.removeSelected'));
    }
  };
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => {
    document.removeEventListener('keydown', onKeyDown);
  });

  const getPackageLinks = (pkgUUID: number) =>
    links().filter(l => l.packageUUID === pkgUUID);

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

  const handleStartDownloads = async () => {
    if (!hasSelection()) {
      return;
    }
    try {
      await jdApi.moveToDownloads([...selectedLinks()], [...selectedPkgs()]);
      clearSelection();
      fetchData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRemove = () => {
    if (!hasSelection()) {
      return;
    }
    openDeleteModal([...selectedLinks()], [...selectedPkgs()], t('grabber.confirm.removeSelected'));
  };

  const handleRemoveLink = (linkId: number) => {
    openDeleteModal([linkId], [], t('grabber.confirm.delete'));
  };

  const getAvailabilityColor = (avail?: string): 'green' | 'red' | 'yellow' | 'blue' => {
    const a = (avail ?? '').toLowerCase();
    if (a === 'online') {
      return 'green';
    }
    if (a === 'offline' || a === 'temp_unknown') {
      return 'red';
    }
    return 'yellow';
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
          <h1 class="text-2xl font-bold tracking-tight text-foreground">{t('grabber.title')}</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {packages().length}
            {' '}
            {t('grabber.packages')}
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <Button variant="default" onClick={() => setShowAddDialog(true)}>
            <span class="i-tabler-plus w-4 h-4" />
            <span class="hidden sm:inline">{t('grabber.addLinks')}</span>
          </Button>

          <Show when={hasSelection()}>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            <Button variant="default" onClick={handleStartDownloads}>
              <span class="i-tabler-player-play w-4 h-4" />
              <span class="hidden sm:inline">{t('grabber.toolbar.start')}</span>
            </Button>
            <Button variant="danger" onClick={handleRemove}>
              <span class="i-tabler-trash w-4 h-4" />
              <span class="hidden sm:inline">{t('grabber.toolbar.remove')}</span>
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
          <span class="text-sm">{t('grabber.jdUnavailable')}</span>
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
          <span class="i-tabler-link-off w-12 h-12 mb-3" />
          <p class="text-sm">{t('grabber.empty')}</p>
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
                    <div
                      class="p-4 cursor-pointer select-none"
                      onClick={e => togglePkgSelect(pkg.uuid, e.shiftKey)}
                    >
                      <div class="flex items-center gap-3">
                        {/* Checkbox */}
                        <Checkbox checked={isSelected()} onChange={() => {}} size="md" class="pointer-events-none flex-shrink-0" />

                        {/* Info */}
                        <div class="flex-1 min-w-0" style={{ opacity: getEnabled(pkg.enabled) ? 1 : 0.4 }}>
                          <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                              <Show
                                when={editingPkgId() === pkg.uuid}
                                fallback={(
                                  <p class="font-semibold text-foreground text-sm truncate" title={pkg.name}>
                                    {pkg.name}
                                  </p>
                                )}
                              >
                                <InlineInput
                                  value={editingName()}
                                  onInput={e => setEditingName(e.currentTarget.value)}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      commitEdit();
                                    }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  onBlur={commitEdit}
                                  ref={el => setTimeout(() => el?.focus(), 0)}
                                />
                              </Show>
                              <div class="flex items-center gap-3 mt-1 flex-wrap">
                                <Show when={pkg.status}>
                                  <StatusBadge status={pkg.status!} iconOnly />
                                </Show>
                                <PriorityBadge priority={pkg.priority} />
                                <span class="text-xs text-muted-foreground">{formatBytes(pkg.bytesTotal)}</span>
                                <Show when={pkg.hosts?.length}>
                                  <span class="text-xs text-muted-foreground">{pkg.hosts!.join(', ')}</span>
                                </Show>
                                <span class="text-xs text-muted-foreground">
                                  {pkg.childCount}
                                  {' '}
                                  Link
                                  {pkg.childCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>

                            <div class="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(pkg.uuid);
                                }}
                              >
                                <span class={`i-tabler-chevron-down w-4 h-4 transition-transform ${isExpanded() ? 'rotate-180' : ''}`} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Links (expanded) */}
                    <Show when={isExpanded() && pkgLinks().length > 0}>
                      <div class="border-t">
                        <For each={pkgLinks()}>
                          {(link) => {
                            const isLinkSelected = () => selectedLinks().has(link.uuid);
                            const availColor = () => getAvailabilityColor(link.availability);

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
                                    <div class="flex items-center justify-between gap-2">
                                      <p class="text-sm text-foreground truncate" title={link.name}>{link.name}</p>
                                      <div class="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveLink(link.uuid);
                                          }}
                                          class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                          title={t('common.remove')}
                                        >
                                          <span class="i-tabler-trash w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div class="flex items-center gap-3 mt-0.5 flex-wrap">
                                      <PriorityBadge priority={link.priority} />
                                      <Show when={link.availability}>
                                        <span class={`text-xs font-medium ${
                                          availColor() === 'green'
                                            ? 'text-green-600 dark:text-green-400'
                                            : availColor() === 'red'
                                              ? 'text-red-600 dark:text-red-400'
                                              : 'text-yellow-600 dark:text-yellow-400'
                                        }`}
                                        >
                                          {link.availability}
                                        </span>
                                      </Show>
                                      <Show when={link.host}>
                                        <span class="text-xs text-muted-foreground">{link.host}</span>
                                      </Show>
                                      <span class="text-xs text-muted-foreground">{formatBytes(link.bytesTotal)}</span>
                                    </div>
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
            {(pkg) => {
              const pkgLinks = () => getPackageLinks(pkg.uuid);
              const isSelected = () => selectedPkgs().has(pkg.uuid);
              const isExpanded = () => expandedPkgs().has(pkg.uuid);

              return (
                <>
                  {/* Package row */}
                  <div
                    class={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer select-none transition-colors ${isSelected() ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-muted/40 hover:bg-muted/70'}`}
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
                            commitEdit();
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                        onBlur={commitEdit}
                        ref={el => setTimeout(() => el?.focus(), 0)}
                        class="flex-1 min-w-0 text-xs"
                      />
                    </Show>
                    <Show when={pkg.status}><StatusBadge status={pkg.status!} /></Show>
                    <span class="text-xs text-muted-foreground flex-shrink-0">{formatBytes(pkg.bytesTotal)}</span>
                    <span class="text-xs text-muted-foreground flex-shrink-0">
                      {pkg.childCount}
                      {' '}
                      Link
                      {pkg.childCount !== 1 ? 's' : ''}
                    </span>
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
                  </div>
                  {/* Link rows */}
                  <Show when={isExpanded()}>
                    <For each={pkgLinks()}>
                      {(link) => {
                        const isLinkSelected = () => selectedLinks().has(link.uuid);
                        const availColor = () => getAvailabilityColor(link.availability);

                        return (
                          <div
                            class={`flex items-center gap-2 px-3 py-1.5 pl-8 border-b last:border-b-0 cursor-pointer select-none transition-colors ${isLinkSelected() ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-muted/50'}`}
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
                            <span class={`i-tabler-circle-filled w-2 h-2 flex-shrink-0 text-${availColor()}-500`} />
                            <span class="text-xs text-muted-foreground flex-shrink-0">{link.host}</span>
                            <span class="text-xs text-muted-foreground flex-shrink-0">{formatBytes(link.bytesTotal)}</span>
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

      {/* Add Links Dialog */}
      <Show when={showAddDialog()}>
        <AddLinksDialog onClose={() => setShowAddDialog(false)} onAdded={fetchData} />
      </Show>

      {/* Context menu — desktop: positioned menu, touch: bottom sheet */}
      <Show when={ctxMenu()} keyed>
        {cm => <ContextMenu x={cm.x} y={cm.y} touch={cm.touch} title={ctxTitle()} items={buildCtxItems()} onClose={() => setCtxMenu(null)} />}
      </Show>
      {/* Delete confirmation modal */}
      <Dialog open={!!deleteModal()} onClose={() => setDeleteModal(null)} title={t('common.delete')}>
        <div class="px-6 py-4 space-y-4">
          <p class="text-sm text-foreground">{deleteModal()?.message}</p>
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
              await jdApi.setGrabberPriority(p, linkIds, pkgIds).catch(e => setError((e as Error).message));
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
      {/* New package modal */}
      <Dialog open={!!newPackageModal()} onClose={closeNewPackageModal} title={t('grabber.newPackageModal.title')}>
        <div class="px-6 py-4 space-y-4">
          <TextField
            type="text"
            value={newPackageName()}
            onChange={setNewPackageName}
            placeholder={t('grabber.newPackageModal.placeholder')}
            inputProps={{
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitNewPackage();
                }
              },
              ref: el => setTimeout(() => el?.focus(), 0),
            }}
          />
          <div class="flex gap-2 justify-end">
            <Button variant="secondary" onClick={closeNewPackageModal}>{t('common.cancel')}</Button>
            <Button variant="default" onClick={commitNewPackage}>{t('common.save')}</Button>
          </div>
        </div>
      </Dialog>
      {/* Touch rename modal */}
      <Dialog open={!!renameModal()} onClose={closeRenameModal} title={t('grabber.renameModal.title')}>
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

export default Grabber;
