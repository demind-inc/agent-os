"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const parts = state?.split(":") ?? [];
    const provider = parts[2] || searchParams.get("provider") || "github";

    if (!code || !state) {
      setStatus("error");
      setError("Missing code or state from OAuth callback");
      return;
    }

    (async () => {
      try {
        const { runId } = await apiFetch<{ ok: boolean; runId: string | null }>(
          "/integrations/oauth/callback",
          {
            method: "POST",
            body: JSON.stringify({ code, state, provider }),
          }
        );

        setStatus("success");
        router.replace(runId ? "/app" : "/settings");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "OAuth failed");
      }
    })();
  }, [searchParams, router]);

  if (status === "loading") {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p>Completing OAuth…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <p style={{ color: "var(--text-danger, #dc2626)", marginBottom: 16 }}>
          {error}
        </p>
        <button
          type="button"
          onClick={() => router.replace("/app")}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            background: "var(--accent, #2563eb)",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          Back to app
        </button>
      </main>
    );
  }

  return null;
}
