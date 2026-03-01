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

/**
 * Subscribe to run execution stream (SSE). Call onChunk for each text chunk, onDone when stream ends.
 * No persistence during stream; server stores one row when done.
 */
export async function apiStreamRun(
  runId: string,
  callbacks: { onChunk: (text: string) => void; onDone: () => void }
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/runs/${runId}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok || !res.body) {
    callbacks.onDone();
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";
  let dataLines: string[] = [];

  const flushEvent = () => {
    if (eventType === "chunk" && dataLines.length > 0) {
      callbacks.onChunk(dataLines.join("\n"));
    }
    if (eventType === "done") {
      callbacks.onDone();
    }
    eventType = "";
    dataLines = [];
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          flushEvent();
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5));
        } else if (line === "") {
          flushEvent();
        }
      }
    }
    flushEvent();
  } finally {
    reader.releaseLock();
    callbacks.onDone();
  }
}
