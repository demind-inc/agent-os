"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import "./project.scss";

type Project = { id: string; name: string; workspace_id: string };

const MOCK_AGENTS = [{ id: "1", name: "Planner Agent", selected: true }, { id: "2", name: "Writer Agent", selected: false }];

export default function ProjectPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agents, setAgents] = useState(MOCK_AGENTS);

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
    setDescription("");
  }

  function chooseProject(id: string) {
    localStorage.setItem("agentos_project_id", id);
    router.push("/app");
  }

  return (
    <main className="projectPage">
      <div className="projectCard">
        <div className="projectHeader">
          <div className="projectIconWrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="projectTitle">Create your first project</h1>
          <p className="projectSubtitle">
            Projects help you organize related tasks and assign AI agents to work on them.
          </p>
        </div>
        <form className="projectForm" onSubmit={createProject}>
          <div className="projectField">
            <label className="projectLabel" htmlFor="projName">
              Project name
            </label>
            <input
              id="projName"
              className="projectInput"
              required
              placeholder="Q4 Campaign Launch"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="projectField">
            <label className="projectLabel" htmlFor="projDesc">
              Description (optional)
            </label>
            <textarea
              id="projDesc"
              className="projectTextarea"
              placeholder="Launch content strategy for Q4 marketing campaign..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="projectField">
            <label className="projectLabel">Assign AI agents</label>
            <div className="projectAgentList">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className={`projectAgentRow ${agent.selected ? "projectAgentRow--active" : ""}`}
                  onClick={() =>
                    setAgents((prev) =>
                      prev.map((a) => (a.id === agent.id ? { ...a, selected: !a.selected } : a))
                    )
                  }
                >
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
          <div className="projectActions">
            <button
              type="button"
              className="projectBackBtn"
              onClick={() => router.push("/workspace")}
            >
              Back
            </button>
            <button type="submit" className="projectSubmit">
              Create project
            </button>
          </div>
        </form>
        {projects.length > 0 && (
          <div className="projectList">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="projectItem"
                onClick={() => chooseProject(p.id)}
              >
                <strong>{p.name}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="projectSteps">
        <span className="projectStep projectStep--active" />
        <span className="projectStep projectStep--active" />
        <span className="projectStep" />
      </div>
    </main>
  );
}
