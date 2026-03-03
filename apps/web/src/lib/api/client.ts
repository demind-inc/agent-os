import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { StreamChunk } from "@/types/stream-chunk";

async function getAccessToken() {
  if (typeof window === "undefined") return null;

  const storedToken = localStorage.getItem("agentos_access_token");
  if (storedToken) return storedToken;

  const supabase = createSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? null;
  if (token) {
    localStorage.setItem("agentos_access_token", token);
  }

  return token;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const token = await getAccessToken();

  const hasBody = init?.body != null && init.body !== "";
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("agentos_access_token");
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
      window.location.assign("/login");
    }
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

/**
 * Poll run execution stream. Call onChunk for each structured chunk, onDone when stream ends.
 * Uses /runs/:runId/chunks with a cursor to fetch new chunks.
 */
export function apiPollRun(
  runId: string,
  callbacks: { onChunk: (chunk: StreamChunk) => void; onDone: () => void },
  options?: { intervalMs?: number }
): () => void {
  let closed = false;
  let cursor = 0;
  let inFlight = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const intervalMs = options?.intervalMs ?? 1200;

  const close = () => {
    closed = true;
    if (timer) clearInterval(timer);
    timer = null;
  };

  const tick = async () => {
    if (closed || inFlight) return;
    inFlight = true;
    try {
      const data = await apiFetch<{
        chunks: StreamChunk[];
        nextCursor: number;
        done?: boolean;
      }>(`/runs/${runId}/chunks?cursor=${cursor}`);
      cursor = Number.isFinite(data.nextCursor) ? data.nextCursor : cursor;
      if (Array.isArray(data.chunks)) {
        for (const chunk of data.chunks) callbacks.onChunk(chunk);
      }
      if (data.done) {
        callbacks.onDone();
        close();
      }
    } catch {
      // ignore errors; next poll may succeed
    } finally {
      inFlight = false;
    }
  };

  void tick();
  timer = setInterval(tick, intervalMs);

  return close;
}
