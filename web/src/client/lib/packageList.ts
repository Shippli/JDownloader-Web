import type { SortState } from '../components/ui/SortDropdown';
import { createMemo, createSignal, onCleanup } from 'solid-js';
import { t } from '../i18n';
import { createLongPress, isTouchDevice } from './longPress';
import { createPersistedSignal } from './persisted';

// Shared state + interaction for the package/link lists (Downloads, Grabber):
// sorting, expansion, multi-selection (shift ranges), context menu incl.
// touch long-press, keyboard shortcuts and click-outside deselect.

type ListPackage = { uuid: number; name: string; status?: string };
type ListLink = { uuid: number; packageUUID: number };
type ListItem = { uuid: number; name: string; enabled?: boolean };

export type ItemType = 'pkg' | 'link';

export type CtxMenuState = { x: number; y: number; type: ItemType; uuid: number; name: string; enabled: boolean; touch?: boolean };

export type Selection = { linkIds: number[]; pkgIds: number[] };

const STATUS_RANK: Record<string, number> = {
  RUNNING: 0,
  WAITING: 1,
  QUEUED: 2,
  STOPPED: 3,
  FINISHED: 4,
};
const STATUS_RANK_MAX = 5;

function toggled(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
}

function withAll(set: Set<number>, ids: number[]): Set<number> {
  return new Set([
    ...set,
    ...ids,
  ]);
}

// Range of uuids between two items (inclusive) in list order, or null if either is missing.
function uuidRange(list: { uuid: number }[], a: number, b: number): number[] | null {
  const i = list.findIndex(x => x.uuid === a);
  const j = list.findIndex(x => x.uuid === b);
  if (i === -1 || j === -1) {
    return null;
  }
  return list.slice(Math.min(i, j), Math.max(i, j) + 1).map(x => x.uuid);
}

function isEditableTarget(e: Event): boolean {
  const tag = (e.target as HTMLElement).tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function createPackageList<P extends ListPackage, L extends ListLink>(opts: {
  packages: () => P[];
  links: () => L[];
  sortKey: string;
  onDeleteSelection: (sel: Selection) => void;
}) {
  // ── Sorting ──
  const [sortState, setSortState] = createPersistedSignal<SortState>(opts.sortKey, { field: 'date', dir: 'desc' });
  // Memoized: sorting runs once per data/sort change instead of once per consumer.
  const sortedPackages = createMemo(() => {
    const pkgs = [
      ...opts.packages(),
    ];
    const { field, dir } = sortState();
    if (field === 'name') {
      pkgs.sort((a, b) => a.name.localeCompare(b.name));
    } else if (field === 'status') {
      const rank = (p: P) => STATUS_RANK[p.status ?? ''] ?? STATUS_RANK_MAX;
      pkgs.sort((a, b) => rank(a) - rank(b));
    }
    return dir === 'desc'
      ? pkgs.reverse()
      : pkgs;
  });

  // Group links by package once per store update (O(L)) instead of filtering the
  // full link list per package per render (O(P*L)).
  const linksByPkg = createMemo(() => {
    const map = new Map<number, L[]>();
    for (const l of opts.links()) {
      const arr = map.get(l.packageUUID);
      if (arr) {
        arr.push(l);
      } else {
        map.set(l.packageUUID, [l]);
      }
    }
    return map;
  });
  const packageLinks = (pkgUUID: number) => linksByPkg().get(pkgUUID) ?? [];

  // ── Expansion ──
  const [expandedPkgs, setExpandedPkgs] = createSignal<Set<number>>(new Set());
  const isExpanded = (uuid: number) => expandedPkgs().has(uuid);
  const toggleExpand = (uuid: number) => setExpandedPkgs(prev => toggled(prev, uuid));

  // ── Selection ──
  const [selectedPkgs, setSelectedPkgs] = createSignal<Set<number>>(new Set());
  const [selectedLinks, setSelectedLinks] = createSignal<Set<number>>(new Set());
  let lastPkgClicked: number | null = null;
  let lastLinkClicked: number | null = null;

  const isPkgSelected = (uuid: number) => selectedPkgs().has(uuid);
  const isLinkSelected = (uuid: number) => selectedLinks().has(uuid);
  const hasSelection = () => selectedPkgs().size > 0 || selectedLinks().size > 0;
  const selectionCount = () => selectedPkgs().size + selectedLinks().size;
  const selection = (): Selection => ({
    linkIds: [
      ...selectedLinks(),
    ],
    pkgIds: [
      ...selectedPkgs(),
    ],
  });

  const selectAll = () => setSelectedPkgs(new Set(opts.packages().map(p => p.uuid)));
  const clearSelection = () => {
    setSelectedPkgs(new Set<number>());
    setSelectedLinks(new Set<number>());
    lastPkgClicked = null;
    lastLinkClicked = null;
  };

  const togglePkgSelect = (uuid: number, shiftKey: boolean) => {
    const range = shiftKey && lastPkgClicked !== null
      ? uuidRange(sortedPackages(), lastPkgClicked, uuid)
      : null;
    if (range) {
      setSelectedPkgs(prev => withAll(prev, range));
      return;
    }
    lastPkgClicked = uuid;
    if (isPkgSelected(uuid)) {
      // Deselecting a package also deselects its links.
      const pkgLinkIds = new Set(packageLinks(uuid).map(l => l.uuid));
      setSelectedLinks(prev => new Set([...prev].filter(id => !pkgLinkIds.has(id))));
    }
    setSelectedPkgs(prev => toggled(prev, uuid));
  };

  const toggleLinkSelect = (uuid: number, shiftKey: boolean) => {
    const range = shiftKey && lastLinkClicked !== null
      ? uuidRange(opts.links(), lastLinkClicked, uuid)
      : null;
    if (range) {
      setSelectedLinks(prev => withAll(prev, range));
      return;
    }
    lastLinkClicked = uuid;
    setSelectedLinks(prev => toggled(prev, uuid));
  };

  // ── Context menu ──
  const [ctxMenu, setCtxMenu] = createSignal<CtxMenuState | null>(null);
  // The menu acts on the whole selection when opened on a selected item.
  const ctxActsOnSelection = (cm: CtxMenuState) =>
    hasSelection() && (cm.type === 'pkg'
      ? isPkgSelected(cm.uuid)
      : isLinkSelected(cm.uuid));
  const ctxTarget = (cm: CtxMenuState): Selection => {
    if (ctxActsOnSelection(cm)) {
      return selection();
    }
    return cm.type === 'pkg'
      ? {
          linkIds: [],
          pkgIds: [cm.uuid],
        }
      : {
          linkIds: [cm.uuid],
          pkgIds: [],
        };
  };
  const ctxTitle = (cm: CtxMenuState) => ctxActsOnSelection(cm)
    ? `${selectionCount()} ${t('common.selected')}`
    : cm.name;

  const longPress = createLongPress<{ type: ItemType; item: ListItem }>(({ type, item }) => setCtxMenu({
    x: 0,
    y: 0,
    type,
    uuid: item.uuid,
    name: item.name,
    enabled: item.enabled ?? false,
    touch: true,
  }));

  // Right-click (desktop) and long-press (touch) handlers for a row.
  const itemHandlers = (type: ItemType, item: ListItem) => ({
    ...longPress({ type, item }),
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTouchDevice()) {
        return;
      }
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        type,
        uuid: item.uuid,
        name: item.name,
        enabled: item.enabled ?? false,
      });
    },
  });

  // ── Keyboard + click-outside ──
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (ctxMenu()) {
        setCtxMenu(null);
      } else {
        clearSelection();
      }
      return;
    }
    if (isEditableTarget(e)) {
      return;
    }
    if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      selectAll();
    } else if (e.key === 'ArrowRight' && selectedPkgs().size > 0) {
      e.preventDefault();
      setExpandedPkgs(prev => withAll(prev, [
        ...selectedPkgs(),
      ]));
    } else if (e.key === 'ArrowLeft' && selectedPkgs().size > 0) {
      e.preventDefault();
      setExpandedPkgs(prev => new Set([...prev].filter(id => !selectedPkgs().has(id))));
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && hasSelection()) {
      e.preventDefault();
      opts.onDeleteSelection(selection());
    }
  };
  const onDocClick = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.closest('main') && !target.closest('[data-list-card]')) {
      clearSelection();
    }
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('click', onDocClick);
  onCleanup(() => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onDocClick);
    longPress.cancel();
  });

  return {
    sortState,
    setSortState,
    sortedPackages,
    packageLinks,
    isExpanded,
    toggleExpand,
    isPkgSelected,
    isLinkSelected,
    hasSelection,
    selection,
    selectAll,
    clearSelection,
    togglePkgSelect,
    toggleLinkSelect,
    ctxMenu,
    setCtxMenu,
    ctxTarget,
    ctxTitle,
    itemHandlers,
  };
}
