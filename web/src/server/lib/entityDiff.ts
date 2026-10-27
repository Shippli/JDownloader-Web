import type { EntityDelta } from '../../shared/sse';
import type { EntityPatch } from './jdEvents';

type Entity = Record<string, unknown>;
type EntityMap = Map<number, Entity>;

export type EntityCache = {
  pkgMap: EntityMap;
  linkMap: EntityMap;
  pkgIdx: Map<number, number>;
  linkIdx: Map<number, number>;
  packages: unknown[];
  links: unknown[];
};

type ArrayDiff = { changed: unknown[]; removedUuids: number[]; newMap: EntityMap };

export function toEntityCache(packages: unknown[], links: unknown[]): EntityCache {
  return {
    pkgMap: toUuidMap(packages),
    linkMap: toUuidMap(links),
    pkgIdx: toIndexMap(packages),
    linkIdx: toIndexMap(links),
    packages,
    links,
  };
}

function toUuidMap(arr: unknown[]): EntityMap {
  return new Map(arr.map(x => [(x as { uuid: number }).uuid, x as Entity]));
}

function toIndexMap(arr: unknown[]): Map<number, number> {
  return new Map(arr.map((x, i) => [(x as { uuid: number }).uuid, i]));
}

// Shallow equality for flat JD API entities (primitives + arrays of primitives,
// e.g. `hosts`). Detects changed, added and removed keys. Falls back to a
// JSON.stringify comparison for any nested object values, so correctness is
// preserved even if JD ever returns nested structures.
function shallowEntityEqual(a: Entity, b: Entity): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }
  for (const k of aKeys) {
    const av = a[k];
    const bv = b[k];
    if (av === bv) {
      continue;
    }
    if (av === null || bv === null || typeof av !== 'object' || typeof bv !== 'object') {
      return false;
    }
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length) {
        return false;
      }
      for (let i = 0; i < av.length; i++) {
        const x = av[i];
        const y = bv[i];
        if (x !== y && (typeof x !== 'object' || typeof y !== 'object' || JSON.stringify(x) !== JSON.stringify(y))) {
          return false;
        }
      }
      continue;
    }
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      return false;
    }
  }
  return true;
}

function diffArrays(prevMap: EntityMap, curr: unknown[]): ArrayDiff {
  const changed: unknown[] = [];
  const newMap: EntityMap = new Map();
  for (const item of curr) {
    const obj = item as Entity;
    const uuid = obj.uuid as number;
    newMap.set(uuid, obj);
    const prev = prevMap.get(uuid);
    if (!prev || !shallowEntityEqual(prev, obj)) {
      changed.push(item);
    }
  }
  const removedUuids: number[] = [];
  for (const uuid of prevMap.keys()) {
    if (!newMap.has(uuid)) {
      removedUuids.push(uuid);
    }
  }
  return { changed, removedUuids, newMap };
}

function buildEntityDelta(changedPkgs: unknown[], removedPkgs: number[], changedLinks: unknown[], removedLinks: number[]): EntityDelta {
  const delta: EntityDelta = {};
  if (changedPkgs.length > 0) {
    delta.packages = changedPkgs;
  }
  if (removedPkgs.length > 0) {
    delta.removedPackages = removedPkgs;
  }
  if (changedLinks.length > 0) {
    delta.links = changedLinks;
  }
  if (removedLinks.length > 0) {
    delta.removedLinks = removedLinks;
  }
  return delta;
}

// Diffs a fresh snapshot against the cache. delta is null when nothing changed.
export function diffSnapshot(cache: EntityCache, packages: unknown[], links: unknown[]): { cache: EntityCache; delta: EntityDelta | null } {
  const pkgDiff = diffArrays(cache.pkgMap, packages);
  const linkDiff = diffArrays(cache.linkMap, links);
  const delta = buildEntityDelta(pkgDiff.changed, pkgDiff.removedUuids, linkDiff.changed, linkDiff.removedUuids);
  return {
    cache: { pkgMap: pkgDiff.newMap, linkMap: linkDiff.newMap, pkgIdx: toIndexMap(packages), linkIdx: toIndexMap(links), packages, links },
    delta: Object.keys(delta).length > 0 ? delta : null,
  };
}

// Applies patches to the cache in place. Changed entities are replaced by new
// objects so already-sent snapshots are never mutated.
export function applyPatchesToCache(cache: EntityCache, patches: EntityPatch[]) {
  const merged = { link: new Map<number, Entity>(), package: new Map<number, Entity>() };
  let unknownUuids = false;
  for (const p of patches) {
    const cacheMap = p.kind === 'link' ? cache.linkMap : cache.pkgMap;
    if (!cacheMap.has(p.uuid)) {
      unknownUuids = true;
      continue;
    }
    const target = merged[p.kind];
    target.set(p.uuid, Object.assign(target.get(p.uuid) ?? {}, p.fields));
  }

  const apply = (fields: EntityMap, map: EntityMap, idx: Map<number, number>, arr: unknown[]) => {
    const changed: unknown[] = [];
    for (const [uuid, f] of fields) {
      const prev = map.get(uuid)!;
      const next = { ...prev, ...f };
      if (shallowEntityEqual(prev, next)) {
        continue;
      }
      map.set(uuid, next);
      const i = idx.get(uuid);
      if (i !== undefined) {
        arr[i] = next;
      }
      changed.push(next);
    }
    return changed;
  };

  const changedLinks = apply(merged.link, cache.linkMap, cache.linkIdx, cache.links);
  const changedPkgs = apply(merged.package, cache.pkgMap, cache.pkgIdx, cache.packages);
  return {
    changedLinks,
    delta: buildEntityDelta(changedPkgs, [], changedLinks, []),
    unknownUuids,
  };
}
