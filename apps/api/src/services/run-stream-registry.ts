/**
 * In-memory registry for run SSE streams. Runner pushes chunks here; GET /runs/:runId/stream
 * subscribes and forwards to the client. No streamed text is stored in DB until the run finishes.
 */

export type RunStreamSender = (event: string, data: string) => void;

const runStreams = new Map<string, Set<RunStreamSender>>();

export function registerRunStream(runId: string, send: RunStreamSender): void {
  let set = runStreams.get(runId);
  if (!set) {
    set = new Set();
    runStreams.set(runId, set);
  }
  set.add(send);
}

export function unregisterRunStream(runId: string, send: RunStreamSender): void {
  const set = runStreams.get(runId);
  if (set) {
    set.delete(send);
    if (set.size === 0) runStreams.delete(runId);
  }
}

export function broadcastRunStreamChunk(runId: string, event: string, data: string): void {
  const set = runStreams.get(runId);
  if (!set) return;
  for (const send of set) {
    try {
      send(event, data);
    } catch (_) {
      // ignore per-client errors
    }
  }
}

export function broadcastRunStreamDone(runId: string): void {
  broadcastRunStreamChunk(runId, "done", "{}");
  runStreams.delete(runId);
}
