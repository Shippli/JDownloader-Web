import type { Component } from 'solid-js';
import type { ContextMenuItem } from '../components/ContextMenu';
import type { CtxMenuState, Selection } from '../lib/packageList';
import type { Priority } from '../lib/priority';
import { useNavigate } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import AddLinksDialog from '../components/AddLinksDialog';
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
import { PromptDialog } from '../components/ui/PromptDialog';
import { SkeletonList } from '../components/ui/Skeleton';
import { t } from '../i18n';
import { formatBytes, jdApi } from '../lib/api';
import { createPackageList } from '../lib/packageList';
import { priorityMenuItem } from '../lib/priority';
import { autoNavigateStore } from '../stores/autoNavigate';
import { compactViewStore } from '../stores/compactView';
import { sseGrabber } from '../stores/sse';

function availabilityClass(avail?: string) {
  const a = (avail ?? '').toLowerCase();
  if (a === 'online') {
    return 'text-success';
  }
  if (a === 'offline' || a === 'temp_unknown') {
    return 'text-destructive';
  }
  return 'text-warning';
}

function linkCountLabel(n: number) {
  return `${n} ${t(n !== 1
    ? 'grabber.links'
    : 'grabber.link')}`;
}

const Grabber: Component = () => {
  const navigate = useNavigate();
  const packages = () => sseGrabber()?.packages ?? [];
  const links = () => sseGrabber()?.links ?? [];
  const loading = () => sseGrabber() === null;

  const [error, setError] = createSignal('');
  const run = (p: Promise<unknown>) => p.catch(e => setError((e as Error).message));

  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [deleteModal, setDeleteModal] = createSignal<Selection & { message: string } | null>(null);
  const [renameModal, setRenameModal] = createSignal<{ uuid: number; name: string } | null>(null);
  const [newPackageModal, setNewPackageModal] = createSignal<Selection & { name: string } | null>(null);
  const [priorityModal, setPriorityModal] = createSignal<Selection | null>(null);

  const openDeleteModal = (sel: Selection, message: string) => setDeleteModal({ ...sel, message });

  const list = createPackageList({
    packages,
    links,
    sortKey: 'grabber.sort',
    onDeleteSelection: sel => openDeleteModal(sel, t('grabber.confirm.removeSelected')),
  });

  const executeDelete = async () => {
    const dm = deleteModal();
    setDeleteModal(null);
    if (dm) {
      await run(jdApi.removeGrabber(dm.linkIds, dm.pkgIds).then(list.clearSelection));
    }
  };

  const startDownloads = async ({ linkIds, pkgIds }: Selection) => {
    try {
      await jdApi.moveToDownloads(linkIds, pkgIds);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    await jdApi.start().catch(() => {});
    list.clearSelection();
    if (autoNavigateStore.enabled()) {
      navigate('/downloads');
    }
  };

  const buildCtxItems = (cm: CtxMenuState): ContextMenuItem[] => {
    const target = list.ctxTarget(cm);
    const { linkIds, pkgIds } = target;
    const setPriority = (p: Priority) => run(jdApi.setGrabberPriority(p, linkIds, pkgIds));
    const items: ContextMenuItem[] = [];

    if (cm.type === 'pkg' && pkgIds.length === 1 && linkIds.length === 0) {
      items.push({
        label: t('grabber.ctx.rename'),
        icon: 'i-tabler-pencil',
        onClick: () => setRenameModal({ uuid: cm.uuid, name: cm.name }),
      });
    }
    items.push(
      {
        label: t('grabber.ctx.delete'),
        icon: 'i-tabler-trash',
        danger: true,
        onClick: () => openDeleteModal(target, t('grabber.confirm.delete')),
      },
      {
        label: cm.enabled
          ? t('common.disable')
          : t('common.enable'),
        icon: cm.enabled ? 'i-tabler-player-pause' : 'i-tabler-player-play',
        onClick: () => run(jdApi.enableGrabber(!cm.enabled, linkIds, pkgIds)),
      },
      priorityMenuItem(cm.touch, () => setPriorityModal(target), setPriority),
      {
        label: t('grabber.ctx.checkStatus'),
        icon: 'i-tabler-refresh',
        onClick: () => run(jdApi.checkGrabberLinks(linkIds, pkgIds)),
      },
      {
        label: t('grabber.ctx.newPackage'),
        icon: 'i-tabler-folder-plus',
        separator: true,
        onClick: () => setNewPackageModal({ ...target, name: cm.name }),
      },
      {
        label: t('grabber.ctx.startDownload'),
        icon: 'i-tabler-player-play',
        onClick: () => startDownloads(target),
      },
    );
    return items;
  };

  return (
    <div>
      {/* Header */}
      <div class="flex items-center justify-between gap-3 mb-6">
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold tracking-tight text-foreground truncate">{t('grabber.title')}</h1>
          <p class="text-sm text-muted-foreground mt-1 truncate">
            {packages().length}
            {' '}
            {t('grabber.packages')}
          </p>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <Button variant="default" onClick={() => setShowAddDialog(true)} icon="i-tabler-plus">
            <span class="hidden sm:inline">{t('grabber.addLinks')}</span>
          </Button>

          <Show when={list.hasSelection()}>
            <div class="w-px h-6 bg-border" />
            <Button variant="default" onClick={() => startDownloads(list.selection())} icon="i-tabler-player-play">
              <span class="hidden sm:inline">{t('grabber.toolbar.start')}</span>
            </Button>
            <Button variant="danger" onClick={() => openDeleteModal(list.selection(), t('grabber.confirm.removeSelected'))} icon="i-tabler-trash">
              <span class="hidden sm:inline">{t('grabber.toolbar.remove')}</span>
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

      <ListAlerts unavailableText={t('grabber.jdUnavailable')} error={error()} />

      <Show when={loading()}>
        <SkeletonList rows={6} />
      </Show>

      <Show when={!loading() && packages().length === 0}>
        <EmptyState icon="i-tabler-link-off" text={t('grabber.empty')} />
      </Show>

      {/* Package list */}
      <Show
        when={compactViewStore.enabled()}
        fallback={(
          <div class="flex flex-col gap-3">
            <For each={list.sortedPackages()}>
              {pkg => (
                <Card
                  class="overflow-hidden transition-all"
                  selected={list.isPkgSelected(pkg.uuid)}
                  data-list-card
                  {...list.itemHandlers('pkg', pkg)}
                >
                  <div
                    class="p-4 cursor-pointer select-none"
                    onClick={e => list.togglePkgSelect(pkg.uuid, e.shiftKey)}
                  >
                    <div class="flex items-center gap-3">
                      <Checkbox checked={list.isPkgSelected(pkg.uuid)} onChange={() => {}} size="md" class="pointer-events-none flex-shrink-0" />

                      <div class="flex-1 min-w-0" classList={{ 'opacity-40': !pkg.enabled }}>
                        <div class="flex items-start justify-between gap-2">
                          <div class="flex-1 min-w-0">
                            <ScrollText class="font-semibold text-foreground text-sm" title={pkg.name}>{pkg.name}</ScrollText>
                            <div class="flex items-center gap-3 mt-1 flex-wrap">
                              <Show when={pkg.status}>
                                <StatusBadge status={pkg.status!} iconOnly />
                              </Show>
                              <PriorityBadge priority={pkg.priority} />
                              <span class="text-xs text-muted-foreground">{formatBytes(pkg.bytesTotal)}</span>
                              <Show when={pkg.hosts?.length}>
                                <span class="text-xs text-muted-foreground">{pkg.hosts!.join(', ')}</span>
                              </Show>
                              <span class="text-xs text-muted-foreground">{linkCountLabel(pkg.childCount)}</span>
                            </div>
                          </div>

                          <ExpandButton expanded={list.isExpanded(pkg.uuid)} onToggle={() => list.toggleExpand(pkg.uuid)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Links (expanded) */}
                  <Show when={list.isExpanded(pkg.uuid) && list.packageLinks(pkg.uuid).length > 0}>
                    <div class="border-t">
                      <For each={list.packageLinks(pkg.uuid)}>
                        {link => (
                          <div
                            class={`px-4 py-3 border-b last:border-0 transition-colors cursor-pointer select-none ${
                              list.isLinkSelected(link.uuid)
                                ? 'bg-info/5'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={e => list.toggleLinkSelect(link.uuid, e.shiftKey)}
                            {...list.itemHandlers('link', link)}
                          >
                            <div class="flex items-center gap-3 pl-8">
                              <Checkbox checked={list.isLinkSelected(link.uuid)} onChange={() => {}} class="pointer-events-none flex-shrink-0" />

                              <div class="flex-1 min-w-0" classList={{ 'opacity-40': !link.enabled }}>
                                <div class="flex items-center justify-between gap-2">
                                  <ScrollText class="text-sm text-foreground" title={link.name}>{link.name}</ScrollText>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteModal({
                                        linkIds: [link.uuid],
                                        pkgIds: [],
                                      }, t('grabber.confirm.delete'));
                                    }}
                                    class="flex-shrink-0 text-destructive hover:bg-destructive/10"
                                    title={t('common.remove')}
                                  >
                                    <span class="i-tabler-trash w-3.5 h-3.5" />
                                  </Button>
                                </div>
                                <div class="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <PriorityBadge priority={link.priority} />
                                  <Show when={link.availability}>
                                    <span class={`text-xs font-medium ${availabilityClass(link.availability)}`}>{link.availability}</span>
                                  </Show>
                                  <Show when={link.host}>
                                    <span class="text-xs text-muted-foreground">{link.host}</span>
                                  </Show>
                                  <span class="text-xs text-muted-foreground">{formatBytes(link.bytesTotal)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Card>
              )}
            </For>
          </div>
        )}
      >
        {/* Compact list */}
        <Card class="overflow-hidden">
          <For each={list.sortedPackages()}>
            {pkg => (
              <>
                {/* Package row */}
                <div
                  class={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer select-none transition-colors ${list.isPkgSelected(pkg.uuid)
                    ? 'bg-info/5'
                    : 'bg-muted/40 hover:bg-muted/70'}`}
                  data-list-card
                  onClick={e => list.togglePkgSelect(pkg.uuid, e.shiftKey)}
                  {...list.itemHandlers('pkg', pkg)}
                >
                  <Checkbox checked={list.isPkgSelected(pkg.uuid)} onChange={() => {}} class="pointer-events-none flex-shrink-0" />
                  <ScrollText class="text-xs font-semibold text-foreground flex-1 min-w-0" classList={{ 'opacity-40': !pkg.enabled }}>{pkg.name}</ScrollText>
                  <Show when={pkg.status}><StatusBadge status={pkg.status!} /></Show>
                  <span class="text-xs text-muted-foreground flex-shrink-0">{formatBytes(pkg.bytesTotal)}</span>
                  <span class="text-xs text-muted-foreground flex-shrink-0">{linkCountLabel(pkg.childCount)}</span>
                  <ExpandButton expanded={list.isExpanded(pkg.uuid)} onToggle={() => list.toggleExpand(pkg.uuid)} class="shrink-0 -mr-1" />
                </div>
                {/* Link rows */}
                <Show when={list.isExpanded(pkg.uuid)}>
                  <For each={list.packageLinks(pkg.uuid)}>
                    {link => (
                      <div
                        class={`flex items-center gap-2 px-3 py-1.5 pl-8 border-b last:border-b-0 cursor-pointer select-none transition-colors ${list.isLinkSelected(link.uuid)
                          ? 'bg-info/5'
                          : 'hover:bg-muted/50'}`}
                        data-list-card
                        onClick={e => list.toggleLinkSelect(link.uuid, e.shiftKey)}
                        {...list.itemHandlers('link', link)}
                      >
                        <Checkbox checked={list.isLinkSelected(link.uuid)} onChange={() => {}} class="pointer-events-none flex-shrink-0" />
                        <ScrollText class="text-xs text-foreground flex-1 min-w-0" classList={{ 'opacity-40': !link.enabled }}>{link.name}</ScrollText>
                        <span class={`i-tabler-circle-filled w-2 h-2 flex-shrink-0 ${availabilityClass(link.availability)}`} />
                        <span class="text-xs text-muted-foreground flex-shrink-0">{link.host}</span>
                        <span class="text-xs text-muted-foreground flex-shrink-0">{formatBytes(link.bytesTotal)}</span>
                      </div>
                    )}
                  </For>
                </Show>
              </>
            )}
          </For>
        </Card>
      </Show>

      <Show when={showAddDialog()}>
        <AddLinksDialog
          onClose={() => setShowAddDialog(false)}
          onAdded={(autostarted) => {
            if (autoNavigateStore.enabled()) {
              navigate(autostarted ? '/downloads' : '/grabber');
            }
          }}
        />
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
      />
      <PriorityDialog
        open={!!priorityModal()}
        onClose={() => setPriorityModal(null)}
        onSelect={(p) => {
          const pm = priorityModal();
          if (pm) {
            run(jdApi.setGrabberPriority(p, pm.linkIds, pm.pkgIds));
          }
        }}
      />
      <PromptDialog
        open={!!newPackageModal()}
        title={t('grabber.newPackageModal.title')}
        initialValue={newPackageModal()?.name}
        placeholder={t('grabber.newPackageModal.placeholder')}
        onSubmit={(name) => {
          const np = newPackageModal()!;
          run(jdApi.moveToNewPackage(np.linkIds, np.pkgIds, name).then(list.clearSelection));
        }}
        onClose={() => setNewPackageModal(null)}
      />
      <PromptDialog
        open={!!renameModal()}
        title={t('grabber.renameModal.title')}
        initialValue={renameModal()?.name}
        onSubmit={name => run(jdApi.renameGrabberPackage(renameModal()!.uuid, name))}
        onClose={() => setRenameModal(null)}
      />
    </div>
  );
};

export default Grabber;
