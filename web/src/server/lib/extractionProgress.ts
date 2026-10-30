// Interpolates extraction progress from JD's (noisy) per-link extraction ETA.

const ETA_ALPHA = 0.3;
const extractStartMap = new Map<number, { startMs: number; smoothedEtaMs: number }>();

// JD's IconKey.ICON_EXTRACT; status text is localized, so it is only a fallback.
export function isExtracting(l: { status?: string; statusIconKey?: string }): boolean {
  return l.statusIconKey === 'extract' || !!l.status?.toLowerCase().includes('extracting');
}

export function updateExtractionProgress(links: unknown[]): Record<number, number> {
  const etaByUuid = new Map<number, number>();

  for (const link of links) {
    const l = link as { uuid: number; status?: string; statusIconKey?: string; eta?: number };
    if (!isExtracting(l)) {
      continue;
    }
    const eta = l.eta ?? 0;
    etaByUuid.set(l.uuid, eta);
    const entry = extractStartMap.get(l.uuid);
    if (!entry) {
      extractStartMap.set(l.uuid, {
        startMs: Date.now(),
        smoothedEtaMs: eta > 0
          ? eta
          : 0,
      });
    } else if (eta > 0) {
      entry.smoothedEtaMs = entry.smoothedEtaMs === 0
        ? eta
        : ETA_ALPHA * eta + (1 - ETA_ALPHA) * entry.smoothedEtaMs;
    }
  }

  for (const uuid of extractStartMap.keys()) {
    if (!etaByUuid.has(uuid)) {
      extractStartMap.delete(uuid);
    }
  }

  const progress: Record<number, number> = {};
  for (const [uuid, entry] of extractStartMap) {
    if (entry.smoothedEtaMs === 0) {
      progress[uuid] = 0;
    } else if ((etaByUuid.get(uuid) ?? 0) <= 0) {
      progress[uuid] = 99;
    } else {
      const elapsedS = (Date.now() - entry.startMs) / 1000;
      progress[uuid] = Math.max(0, Math.min(99, Math.round((elapsedS / (elapsedS + entry.smoothedEtaMs / 1000)) * 100)));
    }
  }
  return progress;
}
