"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

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

    apiFetch<{ projects: Project[] }>(`/workspaces/${workspaceId}/projects`).then((data) => setProjects(data.projects));
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
    <main className="page" style={{ maxWidth: 720, margin: "24px auto" }}>
      <div className="card column">
        <h1>Select a project</h1>
        <form className="row" onSubmit={createProject}>
          <input style={{ flex: 1 }} required placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create</button>
        </form>
        <div className="column">
          {projects.map((project) => (
            <button key={project.id} className="task-card row" onClick={() => chooseProject(project.id)}>
              <strong>{project.name}</strong>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
