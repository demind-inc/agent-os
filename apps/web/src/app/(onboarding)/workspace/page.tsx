"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { OnboardingCard } from "@/components/OnboardingCard/OnboardingCard";
import "./workspace.scss";

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
    <OnboardingCard
      title="Select a workspace"
      inputPlaceholder="Workspace name"
      inputValue={name}
      onInputChange={setName}
      onSubmit={createWorkspace}
      items={workspaces.map((w) => ({ id: w.id, label: w.name }))}
      onSelectItem={chooseWorkspace}
    />
  );
}
