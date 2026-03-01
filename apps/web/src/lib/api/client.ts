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
