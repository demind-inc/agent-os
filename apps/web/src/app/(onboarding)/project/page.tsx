"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { OnboardingCard } from "@/components/OnboardingCard/OnboardingCard";
import "./project.scss";

type Project = { id: string; name: string; workspace_id: string };

export default function ProjectPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");

  const workspaceId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("agentos_workspace_id") || "";
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      router.push("/workspace");
      return;
    }
    apiFetch<{ projects: Project[] }>(`/workspaces/${workspaceId}/projects`).then((data) =>
      setProjects(data.projects)
    );
  }, [workspaceId, router]);

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const project = await apiFetch<Project>(`/workspaces/${workspaceId}/projects`, {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setProjects((prev) => [project, ...prev]);
    setName("");
  }

  function chooseProject(id: string) {
    localStorage.setItem("agentos_project_id", id);
    router.push("/app");
  }

  return (
    <OnboardingCard
      title="Select a project"
      inputPlaceholder="Project name"
      inputValue={name}
      onInputChange={setName}
      onSubmit={createProject}
      items={projects.map((p) => ({ id: p.id, label: p.name }))}
      onSelectItem={chooseProject}
    />
  );
}
