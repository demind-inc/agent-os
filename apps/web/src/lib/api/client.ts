import { createClient as createSupabaseClient } from "@/lib/supabase/client";

async function getAccessToken() {
  if (typeof window === "undefined") return null;

  const storedToken = localStorage.getItem("agentos_access_token");
  if (storedToken) return storedToken;

  const supabase = createSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? null;
  if (token) {
    localStorage.setItem("agentos_access_token", token);
  }

  return token;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const token = await getAccessToken();

  const hasBody = init?.body != null && init.body !== "";
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
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

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function wsBase(): string {
  const base = apiBase();
  return base.replace(/^http/, "ws");
}

/**
 * Subscribe to run execution stream via WebSocket. Call onChunk for each text chunk, onDone when stream ends.
 * Connects once per runId; no persistence during stream; server stores one row when done.
 */
export function apiStreamRun(
  runId: string,
  callbacks: { onChunk: (text: string) => void; onDone: () => void }
): () => void {
  let closed = false;
  let ws: WebSocket | null = null;

  const close = () => {
    closed = true;
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
      ws = null;
    }
  };

  (async () => {
    const t = await getAccessToken();
    if (closed) return;
    const url = `${wsBase()}/runs/${runId}/stream${t ? `?token=${encodeURIComponent(t)}` : ""}`;
    ws = new WebSocket(url);
    ws.onmessage = (e) => {
      if (closed) return;
      try {
        const msg = JSON.parse(e.data as string) as { event?: string; data?: string };
        if (msg.event === "chunk" && typeof msg.data === "string") {
          callbacks.onChunk(msg.data);
        }
        if (msg.event === "done") {
          callbacks.onDone();
          close();
        }
      } catch {
        // ignore parse errors
      }
    };
    ws.onclose = () => {
      if (!closed) callbacks.onDone();
      close();
    };
    ws.onerror = () => {
      if (!closed) callbacks.onDone();
      close();
    };
  })();

  return close;
}
