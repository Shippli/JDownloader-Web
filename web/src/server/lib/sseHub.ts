import type { SseServerMessage } from '../../shared/sse';

// Receives a fully encoded SSE frame, shared by all clients.
export type SseWriter = (frame: Uint8Array) => void;

const clients = new Set<SseWriter>();
const encoder = new TextEncoder();

const HEARTBEAT_MS = 5_000;
// Identifies this server process; a new epoch means seq was reset.
const EPOCH = Date.now().toString(36);

function frameText(msg: SseServerMessage): string {
  return `event: ${msg.type}\ndata: ${JSON.stringify(msg)}\n\n`;
}

function encodeFrame(msg: SseServerMessage): Uint8Array {
  return encoder.encode(frameText(msg));
}

export function clientCount(): number {
  return clients.size;
}

export function addClient(writer: SseWriter, initial: SseServerMessage[]) {
  writer(encoder.encode(`retry: 2000\n${frameText({ type: 'hello', epoch: EPOCH, heartbeatMs: HEARTBEAT_MS })}`));
  for (const msg of initial) {
    writer(encodeFrame(msg));
  }
  clients.add(writer);
}

// Returns true if this was the last client.
export function removeClient(writer: SseWriter): boolean {
  return clients.delete(writer) && clients.size === 0;
}

export function broadcast(msg: SseServerMessage) {
  if (clients.size === 0) {
    return;
  }
  const frame = encodeFrame(msg);
  for (const write of clients) {
    write(frame);
  }
}

// Carries the current global seq so clients detect missed messages (incl. a lost
// last delta while idle) and force a resync. Also doubles as keepalive: its
// absence lets the client watchdog spot a dead/half-open connection (common on
// mobile). EventSource cannot observe SSE comments, so use a real event.
export function startHeartbeat(currentSeq: () => number) {
  setInterval(() => broadcast({ type: 'heartbeat', epoch: EPOCH, seq: currentSeq() }), HEARTBEAT_MS);
}
