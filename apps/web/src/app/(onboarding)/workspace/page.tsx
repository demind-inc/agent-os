"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import "./workspace.scss";

type Workspace = { id: string; name: string };

const TEAM_SIZE_OPTIONS = ["1–10", "11–50", "51+"];

export default function WorkspacePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [teamSize, setTeamSize] = useState<string>(TEAM_SIZE_OPTIONS[0]);
  const wsSlug = name.trim() ? name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : "";

  async function load() {
    const data = await apiFetch<{ workspaces: Workspace[] }>("/workspaces");
    setWorkspaces(data.workspaces);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await apiFetch<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    localStorage.setItem("agentos_workspace_id", data.id);
    router.push("/project");
  }

  function chooseWorkspace(id: string) {
    localStorage.setItem("agentos_workspace_id", id);
    router.push("/project");
  }

  return (
    <main className="workspacePage">
      <div className="workspaceCard">
        <div className="workspaceHeader">
          <div className="workspaceIconWrap">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </div>
          <h1 className="workspaceTitle">Create your workspace</h1>
          <p className="workspaceSubtitle">
            Workspaces help you organize projects and collaborate with your team.
          </p>
        </div>
        <form className="workspaceForm" onSubmit={createWorkspace}>
          <div className="workspaceField">
            <label className="workspaceLabel" htmlFor="wsName">
              Workspace name
            </label>
            <input
              id="wsName"
              className="workspaceInput"
              required
              placeholder="Acme Inc."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="workspaceField">
            <label className="workspaceLabel">Workspace URL</label>
            <div className="workspaceUrlInput">
              <span className="workspaceUrlPrefix">agentos.app/</span>
              <span className="workspaceUrlValue">{wsSlug || "acme-inc"}</span>
            </div>
          </div>
          <div className="workspaceField">
            <label className="workspaceLabel">Team size</label>
            <div className="workspaceTeamOptions">
              {TEAM_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`workspaceTeamOpt ${teamSize === opt ? "workspaceTeamOpt--active" : ""}`}
                  onClick={() => setTeamSize(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="workspaceSubmit">
            Continue
          </button>
        </form>
        {workspaces.length > 0 && (
          <div className="workspaceList">
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                className="workspaceItem"
                onClick={() => chooseWorkspace(w.id)}
              >
                <strong>{w.name}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="workspaceSteps">
        <span className="workspaceStep workspaceStep--active" />
        <span className="workspaceStep" />
        <span className="workspaceStep" />
      </div>
    </main>
  );
}
