"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiStreamRun } from "@/lib/api/client";
import type { StreamChunk } from "@/types/stream-chunk";

export type StreamChunkEntry = {
  chunk: StreamChunk;
  timestamp: string;
};

type RunStreamContextValue = {
  streamedChunks: StreamChunkEntry[];
};

const RunStreamContext = createContext<RunStreamContextValue | null>(null);

export function useRunStream(): RunStreamContextValue {
  const ctx = useContext(RunStreamContext);
  if (!ctx) {
    return { streamedChunks: [] as StreamChunkEntry[] };
  }
  return ctx;
}

type RunStreamProviderProps = {
  children: ReactNode;
  /** Run id to subscribe to; when set with isRunning, connects WebSocket. */
  activeRunId: string | null;
  /** Whether the run is active (queued or running). */
  isRunning: boolean;
  /** Task id; when changed, clears streamedChunks (content is task-specific). */
  taskId: string | null;
  onStreamDone?: () => void;
  onStreamConnect?: () => void;
  onStreamDisconnect?: () => void;
};

export function RunStreamProvider({
  children,
  activeRunId,
  isRunning,
  taskId,
  onStreamDone,
  onStreamConnect,
  onStreamDisconnect,
}: RunStreamProviderProps) {
  const [streamedChunks, setStreamedChunks] = useState<StreamChunkEntry[]>([]);
  const subscribedRunIdRef = useRef<string | null>(null);
  const prevActiveRunIdRef = useRef<string | null>(null);
  const onStreamDoneRef = useRef(onStreamDone);
  const onStreamConnectRef = useRef(onStreamConnect);
  const onStreamDisconnectRef = useRef(onStreamDisconnect);
  onStreamDoneRef.current = onStreamDone;
  onStreamConnectRef.current = onStreamConnect;
  onStreamDisconnectRef.current = onStreamDisconnect;

  // Clear streamedChunks when switching to a different task
  useEffect(() => {
    setStreamedChunks([]);
  }, [taskId]);

  // Subscribe to run stream when isRunning and activeRunId are set.
  // Callbacks in refs to avoid effect re-running on parent re-renders (prevents duplicate WebSocket connections).
  useEffect(() => {
    if (!isRunning || !activeRunId) {
      if (!isRunning) onStreamDisconnectRef.current?.();
      subscribedRunIdRef.current = null;
      return;
    }
    if (subscribedRunIdRef.current === activeRunId) return;
    subscribedRunIdRef.current = activeRunId;
    // Only clear when switching to a different run; preserve history when resuming same run after user input
    if (prevActiveRunIdRef.current !== activeRunId) {
      setStreamedChunks([]);
      prevActiveRunIdRef.current = activeRunId;
    }
    onStreamConnectRef.current?.();

    const close = apiStreamRun(activeRunId, {
      onChunk: (chunk) => {
        const timestamp = new Date().toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        if (process.env.NODE_ENV === "development") {
          console.log("[Agent Log]", { chunk, timestamp });
        }
        setStreamedChunks((prev) => [...prev, { chunk, timestamp }]);
      },
      onDone: () => {
        subscribedRunIdRef.current = null;
        onStreamDisconnectRef.current?.();
        onStreamDoneRef.current?.();
      },
    });
    return () => {
      close();
      subscribedRunIdRef.current = null;
      onStreamDisconnectRef.current?.();
    };
  }, [isRunning, activeRunId]);

  return (
    <RunStreamContext.Provider value={{ streamedChunks }}>
      {children}
    </RunStreamContext.Provider>
  );
}
