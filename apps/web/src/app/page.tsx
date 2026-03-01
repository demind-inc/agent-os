"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function routeUser() {
      const supabase = createClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        localStorage.removeItem("agentos_access_token");
        router.replace("/login");
        return;
      }

      localStorage.setItem("agentos_access_token", session.access_token);

      const workspaceId = localStorage.getItem("agentos_workspace_id");
      if (!workspaceId) {
        router.replace("/workspace");
        return;
      }

      const projectId = localStorage.getItem("agentos_project_id");
      if (!projectId) {
        router.replace("/project");
        return;
      }

      router.replace("/app");
    }

    routeUser().catch(() => router.replace("/login"));
  }, [router]);

  return <main className="page">Redirecting...</main>;
}
