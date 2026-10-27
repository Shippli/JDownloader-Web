import { jd as jdClient } from './jd';

export async function fetchDialogs(): Promise<unknown[]> {
  const ids = await jdClient.call('/dialogs/list');
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }
  const results = await Promise.allSettled(
    ids.map((id: unknown) =>
      jdClient.call('/dialogs/get', [id, false, true])
        .then(data => ({ ...(data as Record<string, unknown>), id })),
    ),
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<unknown>).value);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Polls for and auto-answers subsequent IfFileExists dialogs for the same
// package, in ascending id order (JD requires answering dialogs in order).
export async function applyAnswerToPackage(packageid: string, body: Record<string, unknown>) {
  const deadline = Date.now() + 5 * 60_000;
  let idleRounds = 0;
  let blockedRounds = 0;
  while (Date.now() < deadline) {
    const ids = await jdClient.call('/dialogs/list').catch(() => null);
    if (!Array.isArray(ids) || ids.length === 0) {
      if (++idleRounds > 20) {
        return;
      }
      await sleep(1500);
      continue;
    }
    const nextId = Math.min(...(ids as number[]));
    let detail: Record<string, unknown>;
    try {
      detail = await jdClient.call('/dialogs/get', [nextId, false, true]) as Record<string, unknown>;
    } catch {
      return;
    }
    const properties = detail?.properties as Record<string, unknown> | undefined;
    const isSamePackage = typeof detail?.type === 'string'
      && detail.type.includes('IfFileExists')
      && properties?.packageid === packageid;
    if (!isSamePackage) {
      if (++blockedRounds > 5) {
        return;
      }
      await sleep(1500);
      continue;
    }
    idleRounds = 0;
    blockedRounds = 0;
    try {
      await jdClient.call('/dialogs/answer', [nextId, body]);
    } catch {
      return;
    }
    await sleep(300);
  }
}
