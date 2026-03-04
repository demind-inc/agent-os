/**
 * In-memory registry for run SSE streams. Runner pushes chunks here; GET /runs/:runId/stream
 * subscribes and forwards to the client. No streamed text is stored in DB until the run finishes.
 *
 * Chunk buffer: For external runs (started outside the app), chunks may arrive before any
 * WebSocket client connects. We buffer chunks per runId so late-joining clients receive
 * everything sent so far, then continue streaming new chunks.
 */

export type RunStreamSender = (event: string, data: string) => void;

const runStreams = new Map<string, Set<RunStreamSender>>();
/** Buffered chunks for all runs (external or local) so pollers can fetch history. */
const chunkBuffers = new Map<string, Array<{ event: string; data: string }>>();
const cleanupTimers = new Map<string, NodeJS.Timeout>();

const CLEANUP_DELAY_MS = 5 * 60 * 1000;

function scheduleCleanup(runId: string) {
  const existing = cleanupTimers.get(runId);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(() => {
    chunkBuffers.delete(runId);
    cleanupTimers.delete(runId);
  }, CLEANUP_DELAY_MS);
  cleanupTimers.set(runId, timeout);
}

export function registerRunStream(runId: string, send: RunStreamSender): void {
  let set = runStreams.get(runId);
  if (!set) {
    set = new Set();
    runStreams.set(runId, set);
  }
  set.add(send);

  // Send any buffered chunks to this late-joining client
  const buffer = chunkBuffers.get(runId);
  if (buffer && buffer.length > 0) {
    for (const { event, data } of buffer) {
      try {
        send(event, data);
      } catch (_) {
        // ignore per-client errors
      }
    }
  }
}

export function unregisterRunStream(runId: string, send: RunStreamSender): void {
  const set = runStreams.get(runId);
  if (set) {
    set.delete(send);
    if (set.size === 0) runStreams.delete(runId);
  }
}

export function broadcastRunStreamChunk(runId: string, event: string, data: string): void {
  // Always buffer so polling clients can catch up.
  let buffer = chunkBuffers.get(runId);
  if (!buffer) {
    buffer = [];
    chunkBuffers.set(runId, buffer);
  }
  buffer.push({ event, data });

  const set = runStreams.get(runId);
  if (set && set.size > 0) {
    for (const send of set) {
      try {
        send(event, data);
      } catch (_) {
        // ignore per-client errors
      }
    }
  }
}

export function broadcastRunStreamDone(runId: string): void {
  broadcastRunStreamChunk(runId, "done", "{}");
  runStreams.delete(runId);
  scheduleCleanup(runId);
}

export function getRunStreamBuffer(
  runId: string,
  cursor: number
): { events: Array<{ event: string; data: string }>; nextCursor: number; done: boolean } {
  const buffer = chunkBuffers.get(runId) ?? [];
  const safeCursor = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
  const events = buffer.slice(safeCursor);
  const nextCursor = buffer.length;
  const done = events.some((evt) => evt.event === "done");
  return { events, nextCursor, done };
}
