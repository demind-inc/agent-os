"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api/client";
import "./login.scss";

type Workspace = { id: string; name: string };
type Project = { id: string; name: string; workspace_id: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    localStorage.setItem("agentos_access_token", data.session.access_token);

    try {
      const { workspaces } = await apiFetch<{ workspaces: Workspace[] }>("/workspaces");
      if (workspaces.length > 0) {
        const workspaceId = workspaces[0].id;
        localStorage.setItem("agentos_workspace_id", workspaceId);
        const { projects } = await apiFetch<{ projects: Project[] }>(
          `/workspaces/${workspaceId}/projects`
        );
        if (projects.length > 0) {
          localStorage.setItem("agentos_project_id", projects[0].id);
        }
        router.push("/");
        return;
      }
    } catch {
      // If workspace fetch fails, fall through to workspace creation
    }
    router.push("/workspace");
  }

  return (
    <main className="login">
      <div className="login__card">
        <div className="login__header">
          <h1 className="login__title">Log in</h1>
          <p className="login__subtitle">Welcome back. Sign in to continue.</p>
        </div>
        <form className="login__form" onSubmit={onSubmit}>
          <div className="login__field">
            <label className="login__label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className="login__input"
              required
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="login__field">
            <label className="login__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="login__input"
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="login__error">{error}</p>}
          <button type="submit" className="login__submit">
            Continue
          </button>
        </form>
        <p className="login__signupLink">
          Don&apos;t have an account?
          <Link href="/signup" className="login__signupLinkText">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
