"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

type Workspace = { id: string; name: string };

export default function WorkspacePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState("");

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
    setName("");
    setWorkspaces((prev) => [data, ...prev]);
  }

  function chooseWorkspace(id: string) {
    localStorage.setItem("agentos_workspace_id", id);
    router.push("/project");
  }

  return (
    <main className="page" style={{ maxWidth: 720, margin: "24px auto" }}>
      <div className="card column">
        <h1>Select a workspace</h1>
        <form className="row" onSubmit={createWorkspace}>
          <input style={{ flex: 1 }} required placeholder="Workspace name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create</button>
        </form>
        <div className="column">
          {workspaces.map((workspace) => (
            <button key={workspace.id} className="task-card row" onClick={() => chooseWorkspace(workspace.id)}>
              <strong>{workspace.name}</strong>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
