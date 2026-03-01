"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Agent } from "@/types/domain";
import { AGENT_MODELS } from "@/lib/agents/constants";
import type {
  Profile,
  SettingsSection,
  NavItem,
  SectionMeta,
  Workspace,
  WorkspaceMemberApi,
  IntegrationFromApi,
  NotificationPrefs,
} from "./types";
import {
  INTEGRATION_PROVIDERS,
  DEFAULT_NOTIFICATION_PREFS,
} from "./types";
import { getInitials, memberApiToDisplay, mergeIntegrationsForDisplay } from "./utils";
import {
  SettingsSidebar,
  SettingsHeader,
  ProfileTab,
  WorkspaceTab,
  TeamTab,
  AgentsTab,
  AgentModal,
  IntegrationsTab,
  NotificationsTab,
  BillingTab,
} from "./components";
import type { AgentFormState } from "./components";
import "./settings.scss";

const NAV_ITEMS: NavItem[] = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "workspace", label: "Workspace", icon: "building" },
  { id: "team", label: "Team Members", icon: "users" },
  { id: "agents", label: "AI Agents", icon: "bot" },
  { id: "integrations", label: "Integrations", icon: "plug" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "billing", label: "Billing", icon: "credit-card" },
];

const SECTION_META: SectionMeta = {
  profile: {
    title: "Profile Settings",
    subtitle: "Manage your personal information and account preferences.",
  },
  workspace: {
    title: "Workspace Settings",
    subtitle: "Manage your workspace details and preferences.",
  },
  team: {
    title: "Team Members",
    subtitle: "Manage your team and their permissions.",
  },
  agents: {
    title: "AI Agents",
    subtitle: "Configure and manage your AI agents.",
  },
  integrations: {
    title: "Integrations",
    subtitle: "Connect your workspace with external services.",
  },
  notifications: {
    title: "Notifications",
    subtitle: "Configure how and when you receive notifications.",
  },
  billing: {
    title: "Billing",
    subtitle: "Manage your subscription and payment methods.",
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberApi[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [integrationsFromApi, setIntegrationsFromApi] = useState<IntegrationFromApi[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [notificationPrefsLoading, setNotificationPrefsLoading] = useState(false);
  const workspaceId =
    typeof window !== "undefined"
      ? localStorage.getItem("agentos_workspace_id") || ""
      : "";
  const [agentsList, setAgentsList] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState<AgentFormState>({
    name: "",
    slug: "",
    backend: "claude",
    model: "",
    skills: [],
  });
  const [agentSaving, setAgentSaving] = useState(false);
  const [workspaceSkills, setWorkspaceSkills] = useState<{ id: string; name: string }[]>([]);

  const loadProfile = useCallback(async () => {
    try {
      const url = workspaceId
        ? `/profile?workspaceId=${workspaceId}`
        : "/profile";
      const data = await apiFetch<{ profile: Profile }>(url);
      setProfile(data.profile);
      const parts = (data.profile.full_name || "").trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(" "));
      } else if (data.profile.full_name) {
        setFirstName(data.profile.full_name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const loadAgents = useCallback(async () => {
    if (!workspaceId) return;
    setAgentsLoading(true);
    try {
      const data = await apiFetch<{ agents: Agent[] }>(
        `/workspaces/${workspaceId}/agents`
      );
      setAgentsList(data.agents ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setAgentsLoading(false);
    }
  }, [workspaceId]);

  const loadWorkspaceSkills = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await apiFetch<{ skills: { id: string; name: string }[] }>(
        `/workspaces/${workspaceId}/skills`
      );
      setWorkspaceSkills(data.skills ?? []);
    } catch (e) {
      console.error(e);
    }
  }, [workspaceId]);

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    setWorkspaceLoading(true);
    try {
      const data = await apiFetch<Workspace>(`/workspaces/${workspaceId}`);
      setWorkspace(data);
    } catch (e) {
      console.error(e);
    } finally {
      setWorkspaceLoading(false);
    }
  }, [workspaceId]);

  const loadMembers = useCallback(async () => {
    if (!workspaceId) return;
    setMembersLoading(true);
    try {
      const data = await apiFetch<{ members: WorkspaceMemberApi[] }>(
        `/workspaces/${workspaceId}/members`
      );
      setMembers(data.members ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setMembersLoading(false);
    }
  }, [workspaceId]);

  const loadIntegrations = useCallback(async () => {
    if (!workspaceId) return;
    setIntegrationsLoading(true);
    try {
      const data = await apiFetch<{ integrations: IntegrationFromApi[] }>(
        `/workspaces/${workspaceId}/integrations`
      );
      setIntegrationsFromApi(data.integrations ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setIntegrationsLoading(false);
    }
  }, [workspaceId]);

  const loadNotificationSettings = useCallback(async () => {
    setNotificationPrefsLoading(true);
    try {
      const data = await apiFetch<{ key: string; value: NotificationPrefs | null }>(
        "/user/settings?key=notifications"
      );
      if (data.value && typeof data.value === "object") {
        setNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...data.value });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNotificationPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeSection === "agents" && workspaceId) {
      loadAgents();
      loadWorkspaceSkills();
    }
  }, [activeSection, workspaceId, loadAgents, loadWorkspaceSkills]);

  useEffect(() => {
    if (activeSection === "workspace" && workspaceId) loadWorkspace();
  }, [activeSection, workspaceId, loadWorkspace]);

  useEffect(() => {
    if (activeSection === "team" && workspaceId) loadMembers();
  }, [activeSection, workspaceId, loadMembers]);

  useEffect(() => {
    if (activeSection === "integrations" && workspaceId) loadIntegrations();
  }, [activeSection, workspaceId, loadIntegrations]);

  useEffect(() => {
    if (activeSection === "notifications") loadNotificationSettings();
  }, [activeSection, loadNotificationSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(" ");
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName || undefined }),
      });
      setProfile((p) => (p ? { ...p, full_name: fullName || null } : null));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("agentos_access_token");
    localStorage.removeItem("agentos_workspace_id");
    localStorage.removeItem("agentos_project_id");
    router.push("/login");
  }

  async function handleDeleteAccount() {
    if (
      !confirm(
        "Permanently delete your account and all data? This cannot be undone."
      )
    )
      return;
    setDeleting(true);
    try {
      await apiFetch("/profile", { method: "DELETE" });
      localStorage.removeItem("agentos_access_token");
      localStorage.removeItem("agentos_workspace_id");
      localStorage.removeItem("agentos_project_id");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error(err);
      alert("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function saveWorkspace(name: string) {
    if (!workspaceId || !workspace) return;
    setWorkspaceSaving(true);
    try {
      const data = await apiFetch<Workspace>(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setWorkspace(data);
    } catch (err) {
      console.error(err);
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function togglePreference(key: keyof NotificationPrefs) {
    const next = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(next);
    try {
      await apiFetch("/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "notifications", value: next }),
      });
    } catch (err) {
      console.error(err);
      setNotificationPrefs(notificationPrefs);
    }
  }

  function openAddAgentModal() {
    setEditingAgent(null);
    setAgentForm({
      name: "",
      slug: "",
      backend: "claude",
      model: AGENT_MODELS.claude[0].value,
      skills: [],
    });
    setAgentModalOpen(true);
  }

  function openEditAgentModal(agent: Agent) {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      slug: agent.slug,
      backend: agent.backend,
      model: agent.model,
      skills: agent.config?.skills ?? [],
    });
    setAgentModalOpen(true);
  }

  async function handleImportSkillFromUrl(url: string, name?: string) {
    if (!workspaceId) return;
    const data = await apiFetch<{ id: string; name: string }>(
      `/workspaces/${workspaceId}/skills/import-from-url`,
      {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), name: name?.trim() || undefined }),
      }
    );
    setAgentForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(data.name) ? prev.skills : [...prev.skills, data.name],
    }));
    await loadWorkspaceSkills();
  }

  async function handleSaveAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setAgentSaving(true);
    try {
      if (editingAgent) {
        await apiFetch(`/workspaces/${workspaceId}/agents/${editingAgent.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: agentForm.name,
            slug: agentForm.slug,
            backend: agentForm.backend,
            model: agentForm.model,
            config: { skills: agentForm.skills },
          }),
        });
      } else {
        await apiFetch(`/workspaces/${workspaceId}/agents`, {
          method: "POST",
          body: JSON.stringify({
            name: agentForm.name,
            slug: agentForm.slug,
            backend: agentForm.backend,
            model: agentForm.model,
            config: { skills: agentForm.skills },
          }),
        });
      }
      setAgentModalOpen(false);
      loadAgents();
    } catch (err) {
      console.error(err);
    } finally {
      setAgentSaving(false);
    }
  }

  function toggleAgentSkill(skill: string) {
    setAgentForm((prev) =>
      prev.skills.includes(skill)
        ? { ...prev, skills: prev.skills.filter((s) => s !== skill) }
        : { ...prev, skills: [...prev.skills, skill] }
    );
  }

  if (loading) {
    return (
      <main className="settingsPage">
        <div className="settingsPage__inner">
          <div className="settingsPage__sidebar" />
          <div className="settingsPage__main">
            <div className="settingsPage__loadingWrap">
              <div className="settingsPage__spinner" aria-label="Loading" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="settingsPage">
        <div className="settingsPage__inner">
          <p className="settingsPage__loading">Unable to load profile.</p>
        </div>
      </main>
    );
  }

  const initials = getInitials(profile.full_name, profile.email);
  const { title, subtitle } = SECTION_META[activeSection];
  const isProfile = activeSection === "profile";
  const headerAction =
    activeSection === "team"
      ? { label: "Invite Member", icon: "user-plus" }
      : activeSection === "agents"
      ? { label: "Add Agent", icon: "plus" }
      : null;

  return (
    <main className="settingsPage">
      <div className="settingsPage__inner">
        <SettingsSidebar
          navItems={NAV_ITEMS}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div
          className={`settingsPage__main ${
            !isProfile ? "settingsPage__main--muted" : ""
          }`}
        >
          <SettingsHeader
            title={title}
            subtitle={subtitle}
            action={headerAction}
            onActionClick={
              activeSection === "agents" ? openAddAgentModal : undefined
            }
          />

          {activeSection === "profile" && (
            <ProfileTab
              profile={profile}
              initials={initials}
              firstName={firstName}
              lastName={lastName}
              saving={saving}
              onFirstNameChange={setFirstName}
              onLastNameChange={setLastName}
              onSave={handleSave}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
              deleting={deleting}
            />
          )}

          {activeSection === "workspace" && (
            <WorkspaceTab
              workspace={workspace}
              workspaceLoading={workspaceLoading}
              workspaceSaving={workspaceSaving}
              onWorkspaceNameChange={(name) =>
                setWorkspace((prev) => (prev ? { ...prev, name } : null))
              }
              onSave={() => workspace && saveWorkspace(workspace.name)}
            />
          )}

          {activeSection === "team" && (
            <TeamTab
              teamMembers={members.map(memberApiToDisplay)}
              membersLoading={membersLoading}
            />
          )}

          {activeSection === "agents" && (
            <AgentsTab
              agentsList={agentsList}
              agentsLoading={agentsLoading}
              onEditAgent={openEditAgentModal}
            />
          )}

          {activeSection === "integrations" && (
            <IntegrationsTab
              integrations={mergeIntegrationsForDisplay(
                integrationsFromApi,
                INTEGRATION_PROVIDERS
              )}
              integrationsLoading={integrationsLoading}
            />
          )}

          {activeSection === "notifications" && (
            <NotificationsTab
              notificationPrefs={notificationPrefs}
              loading={notificationPrefsLoading}
              onToggle={togglePreference}
            />
          )}

          {activeSection === "billing" && <BillingTab />}
        </div>
      </div>

      <AgentModal
        open={agentModalOpen}
        editingAgent={editingAgent}
        form={agentForm}
        saving={agentSaving}
        workspaceSkills={workspaceSkills}
        onFormChange={setAgentForm}
        onClose={() => setAgentModalOpen(false)}
        onSubmit={handleSaveAgent}
        onToggleSkill={toggleAgentSkill}
        onImportSkillFromUrl={handleImportSkillFromUrl}
      />
    </main>
  );
}
