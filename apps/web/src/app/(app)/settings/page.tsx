"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Agent, AgentBackend } from "@/types/domain";
import {
  AGENT_BACKENDS,
  AGENT_MODELS,
  AVAILABLE_SKILLS,
} from "@/lib/agents/constants";
import "./settings.scss";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

function getInitials(fullName: string | null, email: string): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return fullName.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

function formatRole(role: string | null | undefined): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<
    | "profile"
    | "workspace"
    | "team"
    | "agents"
    | "integrations"
    | "notifications"
    | "billing"
  >("profile");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("Acme Design Studio");
  const [notificationPrefs, setNotificationPrefs] = useState({
    taskUpdates: true,
    agentActivity: true,
    weeklyDigest: false,
    desktopNotifications: true,
    soundAlerts: false,
  });
  const workspaceId =
    typeof window !== "undefined"
      ? localStorage.getItem("agentos_workspace_id") || ""
      : "";
  const [agentsList, setAgentsList] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({
    name: "",
    slug: "",
    backend: "claude" as AgentBackend,
    model: "",
    skills: [] as string[],
  });
  const [agentSaving, setAgentSaving] = useState(false);

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

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeSection === "agents" && workspaceId) loadAgents();
  }, [activeSection, workspaceId, loadAgents]);

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

  if (loading) {
    return (
      <main className="settingsPage">
        <div className="settingsPage__inner">
          <div className="settingsPage__sidebar" />
          <div className="settingsPage__main">
            <p className="settingsPage__loading">Loading…</p>
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

  const navItems: { id: typeof activeSection; label: string; icon: string }[] =
    [
      { id: "profile", label: "Profile", icon: "user" },
      { id: "workspace", label: "Workspace", icon: "building" },
      { id: "team", label: "Team Members", icon: "users" },
      { id: "agents", label: "AI Agents", icon: "bot" },
      { id: "integrations", label: "Integrations", icon: "plug" },
      { id: "notifications", label: "Notifications", icon: "bell" },
      { id: "billing", label: "Billing", icon: "credit-card" },
    ];

  const sectionMeta: Record<
    typeof activeSection,
    { title: string; subtitle: string }
  > = {
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

  const headerAction =
    activeSection === "team"
      ? { label: "Invite Member", icon: "user-plus" }
      : activeSection === "agents"
      ? { label: "Add Agent", icon: "plus" }
      : null;

  const teamMembers = [
    {
      id: "1",
      initials: "JD",
      name: "John Doe",
      email: "john@company.com",
      role: "Admin",
      roleTone: "purple",
      status: "Active",
    },
    {
      id: "2",
      initials: "SJ",
      name: "Sarah Johnson",
      email: "sarah@company.com",
      role: "Editor",
      roleTone: "blue",
      status: "Active",
    },
    {
      id: "3",
      initials: "MC",
      name: "Mike Chen",
      email: "mike@company.com",
      role: "Viewer",
      roleTone: "gray",
      status: "Active",
    },
    {
      id: "4",
      initials: "EW",
      name: "Emily Wilson",
      email: "emily@company.com",
      role: "Editor",
      roleTone: "blue",
      status: "Pending",
    },
  ];

  const integrations = [
    {
      id: "github",
      name: "GitHub",
      description: "Connect repositories and track commits",
      icon: "github",
      color: "#24292F",
      connected: true,
    },
    {
      id: "slack",
      name: "Slack",
      description: "Send notifications to Slack channels",
      icon: "message-circle",
      color: "#5865F2",
      connected: true,
    },
    {
      id: "gcal",
      name: "Google Calendar",
      description: "Sync tasks with your calendar",
      icon: "calendar",
      color: "#4285F4",
      connected: false,
    },
    {
      id: "jira",
      name: "Jira",
      description: "Import and sync Jira issues",
      icon: "trello",
      color: "#0052CC",
      connected: false,
    },
  ];

  const togglePreference = (key: keyof typeof notificationPrefs) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const { title, subtitle } = sectionMeta[activeSection];
  const isProfile = activeSection === "profile";

  return (
    <main className="settingsPage">
      <div className="settingsPage__inner">
        <aside className="settingsPage__sidebar">
          <div className="settingsPage__sidebarHeader">
            <div className="settingsPage__logo" aria-hidden />
            <span className="settingsPage__sidebarTitle">Settings</span>
          </div>
          <nav className="settingsPage__nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settingsPage__navItem ${
                  activeSection === item.id
                    ? "settingsPage__navItem--active"
                    : ""
                }`}
                onClick={() => setActiveSection(item.id)}
              >
                <span
                  className="settingsPage__navIcon"
                  data-icon={item.icon}
                  aria-hidden
                />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <div
          className={`settingsPage__main ${
            !isProfile ? "settingsPage__main--muted" : ""
          }`}
        >
          <header
            className={`settingsPage__header ${
              headerAction ? "settingsPage__header--split" : ""
            }`}
          >
            <div className="settingsPage__headerText">
              <h1 className="settingsPage__title">{title}</h1>
              <p className="settingsPage__subtitle">{subtitle}</p>
            </div>
            {headerAction && (
              <button
                type="button"
                className="settingsPage__actionBtn"
                onClick={
                  activeSection === "agents" ? openAddAgentModal : undefined
                }
              >
                <span
                  className="settingsPage__icon"
                  data-icon={headerAction.icon}
                  aria-hidden
                />
                {headerAction.label}
              </button>
            )}
          </header>

          {activeSection === "profile" && (
            <>
              <section className="settingsPage__avatarSection">
                <div
                  className="settingsPage__avatar"
                  title={profile.full_name || profile.email}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="settingsPage__avatarImg"
                    />
                  ) : (
                    <span className="settingsPage__avatarInitials">
                      {initials}
                    </span>
                  )}
                </div>
                <div className="settingsPage__avatarInfo">
                  <span className="settingsPage__avatarName">
                    {profile.full_name || profile.email}
                  </span>
                  <span className="settingsPage__avatarEmail">
                    {profile.email}
                  </span>
                  <span className="settingsPage__avatarRole">
                    {formatRole(profile.role)}
                  </span>
                </div>
                <button
                  type="button"
                  className="settingsPage__avatarUpload"
                  disabled
                  aria-label="Change photo"
                >
                  <span
                    className="settingsPage__avatarUploadIcon"
                    aria-hidden
                  />
                  Change photo
                </button>
              </section>

              <form className="settingsPage__form" onSubmit={handleSave}>
                <div className="settingsPage__formRow">
                  <div className="settingsPage__formField">
                    <label
                      className="settingsPage__formLabel"
                      htmlFor="firstName"
                    >
                      First name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      className="settingsPage__formInput"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="settingsPage__formField">
                    <label
                      className="settingsPage__formLabel"
                      htmlFor="lastName"
                    >
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      className="settingsPage__formInput"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="settingsPage__formField">
                  <label className="settingsPage__formLabel">
                    Email address
                  </label>
                  <div className="settingsPage__formInput settingsPage__formInput--readOnly">
                    {profile.email}
                  </div>
                </div>
                <div className="settingsPage__formField">
                  <label className="settingsPage__formLabel">Role</label>
                  <div className="settingsPage__formInput settingsPage__formInput--readOnly">
                    {formatRole(profile.role)}
                  </div>
                </div>
                <div className="settingsPage__actions">
                  <Link
                    href="/app"
                    className="settingsPage__btn settingsPage__btn--secondary"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    className="settingsPage__btn settingsPage__btn--primary"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>

              <div className="settingsPage__logoutSection">
                <button
                  type="button"
                  className="settingsPage__logoutBtn"
                  onClick={handleLogout}
                >
                  <span className="settingsPage__logoutIcon" aria-hidden />
                  Log out
                </button>
              </div>

              <div className="settingsPage__dangerSection">
                <h3 className="settingsPage__dangerTitle">
                  Testing: Delete account
                </h3>
                <p className="settingsPage__dangerText">
                  Permanently remove your profile and auth user. All your data
                  will be deleted.
                </p>
                <button
                  type="button"
                  className="settingsPage__deleteAccountBtn"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete account"}
                </button>
              </div>
            </>
          )}

          {activeSection === "workspace" && (
            <>
              <div className="settingsPage__card">
                <div className="settingsPage__cardSection">
                  <h3 className="settingsPage__cardTitle">General</h3>
                  <div className="settingsPage__fieldRow">
                    <div className="settingsPage__field">
                      <label
                        className="settingsPage__formLabel"
                        htmlFor="workspaceName"
                      >
                        Workspace name
                      </label>
                      <input
                        id="workspaceName"
                        type="text"
                        className="settingsPage__input"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                      />
                    </div>
                    <div className="settingsPage__field">
                      <label
                        className="settingsPage__formLabel"
                        htmlFor="workspaceUrl"
                      >
                        Workspace URL
                      </label>
                      <input
                        id="workspaceUrl"
                        type="text"
                        className="settingsPage__input settingsPage__input--readOnly"
                        value="acme.agentos.ai"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
                <div className="settingsPage__divider" />
                <div className="settingsPage__cardSection">
                  <h3 className="settingsPage__cardTitle">Workspace Logo</h3>
                  <div className="settingsPage__logoRow">
                    <div className="settingsPage__logoPreview">A</div>
                    <div className="settingsPage__logoActions">
                      <button
                        type="button"
                        className="settingsPage__btn settingsPage__btn--secondary settingsPage__btn--sm"
                      >
                        <span
                          className="settingsPage__icon"
                          data-icon="upload"
                          aria-hidden
                        />
                        Upload logo
                      </button>
                      <span className="settingsPage__hint">
                        PNG, JPG up to 2MB
                      </span>
                    </div>
                  </div>
                </div>
                <div className="settingsPage__divider" />
                <div className="settingsPage__cardSection">
                  <h3 className="settingsPage__cardTitle settingsPage__cardTitle--danger">
                    Danger Zone
                  </h3>
                  <div className="settingsPage__dangerBox">
                    <div className="settingsPage__dangerInfo">
                      <span className="settingsPage__dangerLabel">
                        Delete workspace
                      </span>
                      <span className="settingsPage__dangerSubtext">
                        Once deleted, all data will be permanently removed.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="settingsPage__btn settingsPage__btn--danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              <div className="settingsPage__actions settingsPage__actions--left">
                <button
                  type="button"
                  className="settingsPage__btn settingsPage__btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="settingsPage__btn settingsPage__btn--accent"
                >
                  Save changes
                </button>
              </div>
            </>
          )}

          {activeSection === "team" && (
            <div className="settingsPage__table">
              <div className="settingsPage__tableHeader">
                <span>Member</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span />
              </div>
              {teamMembers.map((member) => (
                <div key={member.id} className="settingsPage__tableRow">
                  <div className="settingsPage__memberInfo">
                    <div
                      className={`settingsPage__memberAvatar settingsPage__memberAvatar--${member.roleTone}`}
                    >
                      {member.initials}
                    </div>
                    <span className="settingsPage__memberName">
                      {member.name}
                    </span>
                  </div>
                  <span className="settingsPage__memberEmail">
                    {member.email}
                  </span>
                  <span
                    className={`settingsPage__pill settingsPage__pill--${member.roleTone}`}
                  >
                    {member.role}
                  </span>
                  <span
                    className={`settingsPage__status settingsPage__status--${
                      member.status === "Active" ? "active" : "pending"
                    }`}
                  >
                    <span className="settingsPage__statusDot" aria-hidden />
                    {member.status}
                  </span>
                  <div className="settingsPage__rowActions">
                    <button
                      type="button"
                      className="settingsPage__iconBtn"
                      aria-label="Edit member"
                    >
                      <span
                        className="settingsPage__icon"
                        data-icon="pencil"
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      className="settingsPage__iconBtn"
                      aria-label="More actions"
                    >
                      <span
                        className="settingsPage__icon"
                        data-icon="ellipsis"
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === "agents" && (
            <div className="settingsPage__list">
              {agentsLoading ? (
                <p className="settingsPage__loading">Loading agents…</p>
              ) : (
                agentsList.map((agent) => (
                  <div key={agent.id} className="settingsPage__agentCard">
                    <div className="settingsPage__agentAvatar settingsPage__agentAvatar--purple">
                      {agent.name.charAt(0)}
                    </div>
                    <div className="settingsPage__agentInfo">
                      <span className="settingsPage__agentName">
                        {agent.name}
                      </span>
                      <span className="settingsPage__agentDesc">
                        {agent.backend} · {agent.model}
                        {agent.config?.skills?.length
                          ? ` · ${agent.config.skills.join(", ")}`
                          : ""}
                      </span>
                    </div>
                    <div className="settingsPage__rowActions">
                      <button
                        type="button"
                        className="settingsPage__iconBtn"
                        aria-label="Edit agent"
                        onClick={() => openEditAgentModal(agent)}
                      >
                        <span
                          className="settingsPage__icon"
                          data-icon="pencil"
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === "integrations" && (
            <div className="settingsPage__integrationGrid">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="settingsPage__integrationCard"
                >
                  <div className="settingsPage__integrationHeader">
                    <div
                      className="settingsPage__integrationIcon"
                      style={{ backgroundColor: integration.color }}
                    >
                      <span
                        className="settingsPage__icon settingsPage__icon--inverse"
                        data-icon={integration.icon}
                        aria-hidden
                      />
                    </div>
                    <div className="settingsPage__integrationInfo">
                      <span className="settingsPage__integrationName">
                        {integration.name}
                      </span>
                      <span className="settingsPage__integrationDesc">
                        {integration.description}
                      </span>
                    </div>
                  </div>
                  <div className="settingsPage__integrationFooter">
                    {integration.connected ? (
                      <span className="settingsPage__status settingsPage__status--active">
                        <span className="settingsPage__statusDot" aria-hidden />
                        Connected
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`settingsPage__btn settingsPage__btn--sm ${
                        integration.connected
                          ? "settingsPage__btn--secondary"
                          : "settingsPage__btn--accent"
                      }`}
                    >
                      {integration.connected ? "Configure" : "Connect"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === "notifications" && (
            <div className="settingsPage__card">
              <div className="settingsPage__cardSection">
                <h3 className="settingsPage__cardTitle">Email Notifications</h3>
                <div className="settingsPage__toggleRow">
                  <div className="settingsPage__toggleInfo">
                    <span className="settingsPage__toggleTitle">
                      Task updates
                    </span>
                    <span className="settingsPage__toggleDesc">
                      Get notified when tasks are assigned, completed, or need
                      attention.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`settingsPage__toggle ${
                      notificationPrefs.taskUpdates
                        ? "settingsPage__toggle--on"
                        : ""
                    }`}
                    onClick={() => togglePreference("taskUpdates")}
                    aria-pressed={notificationPrefs.taskUpdates}
                  >
                    <span className="settingsPage__toggleKnob" />
                  </button>
                </div>
                <div className="settingsPage__toggleRow">
                  <div className="settingsPage__toggleInfo">
                    <span className="settingsPage__toggleTitle">
                      Agent activity
                    </span>
                    <span className="settingsPage__toggleDesc">
                      Receive updates when AI agents complete tasks or need
                      approval.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`settingsPage__toggle ${
                      notificationPrefs.agentActivity
                        ? "settingsPage__toggle--on"
                        : ""
                    }`}
                    onClick={() => togglePreference("agentActivity")}
                    aria-pressed={notificationPrefs.agentActivity}
                  >
                    <span className="settingsPage__toggleKnob" />
                  </button>
                </div>
                <div className="settingsPage__toggleRow">
                  <div className="settingsPage__toggleInfo">
                    <span className="settingsPage__toggleTitle">
                      Weekly digest
                    </span>
                    <span className="settingsPage__toggleDesc">
                      Get a weekly summary of your workspace activity.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`settingsPage__toggle ${
                      notificationPrefs.weeklyDigest
                        ? "settingsPage__toggle--on"
                        : ""
                    }`}
                    onClick={() => togglePreference("weeklyDigest")}
                    aria-pressed={notificationPrefs.weeklyDigest}
                  >
                    <span className="settingsPage__toggleKnob" />
                  </button>
                </div>
              </div>
              <div className="settingsPage__divider" />
              <div className="settingsPage__cardSection">
                <h3 className="settingsPage__cardTitle">Push Notifications</h3>
                <div className="settingsPage__toggleRow">
                  <div className="settingsPage__toggleInfo">
                    <span className="settingsPage__toggleTitle">
                      Desktop notifications
                    </span>
                    <span className="settingsPage__toggleDesc">
                      Show desktop notifications for important updates.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`settingsPage__toggle ${
                      notificationPrefs.desktopNotifications
                        ? "settingsPage__toggle--on"
                        : ""
                    }`}
                    onClick={() => togglePreference("desktopNotifications")}
                    aria-pressed={notificationPrefs.desktopNotifications}
                  >
                    <span className="settingsPage__toggleKnob" />
                  </button>
                </div>
                <div className="settingsPage__toggleRow">
                  <div className="settingsPage__toggleInfo">
                    <span className="settingsPage__toggleTitle">
                      Sound alerts
                    </span>
                    <span className="settingsPage__toggleDesc">
                      Play a sound for new notifications.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`settingsPage__toggle ${
                      notificationPrefs.soundAlerts
                        ? "settingsPage__toggle--on"
                        : ""
                    }`}
                    onClick={() => togglePreference("soundAlerts")}
                    aria-pressed={notificationPrefs.soundAlerts}
                  >
                    <span className="settingsPage__toggleKnob" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "billing" && (
            <>
              <div className="settingsPage__card settingsPage__planCard">
                <div className="settingsPage__planInfo">
                  <div className="settingsPage__planHeader">
                    <span className="settingsPage__planName">Pro Plan</span>
                    <span className="settingsPage__pill settingsPage__pill--green">
                      Active
                    </span>
                  </div>
                  <span className="settingsPage__planDesc">
                    $29/month • Billed monthly • Renews on Mar 15, 2026
                  </span>
                </div>
                <div className="settingsPage__planActions">
                  <button
                    type="button"
                    className="settingsPage__btn settingsPage__btn--accent settingsPage__btn--sm"
                  >
                    Upgrade Plan
                  </button>
                  <button
                    type="button"
                    className="settingsPage__btn settingsPage__btn--secondary settingsPage__btn--sm"
                  >
                    Manage
                  </button>
                </div>
              </div>
              <div className="settingsPage__billingGrid">
                <div className="settingsPage__card">
                  <div className="settingsPage__cardHeader">
                    <h3 className="settingsPage__cardTitle">Payment Method</h3>
                    <button
                      type="button"
                      className="settingsPage__btn settingsPage__btn--secondary settingsPage__btn--xs"
                    >
                      <span
                        className="settingsPage__icon"
                        data-icon="plus"
                        aria-hidden
                      />
                      Add
                    </button>
                  </div>
                  <div className="settingsPage__paymentMethod">
                    <div className="settingsPage__paymentIcon">VISA</div>
                    <div className="settingsPage__paymentInfo">
                      <span className="settingsPage__paymentNumber">
                        •••• •••• •••• 4242
                      </span>
                      <span className="settingsPage__paymentExpiry">
                        Expires 12/2027
                      </span>
                    </div>
                    <span className="settingsPage__pill settingsPage__pill--purple">
                      Default
                    </span>
                  </div>
                </div>
                <div className="settingsPage__card">
                  <h3 className="settingsPage__cardTitle">Current Usage</h3>
                  <div className="settingsPage__usageItem">
                    <div className="settingsPage__usageHeader">
                      <span>AI Agent Tasks</span>
                      <span>847 / 1,000</span>
                    </div>
                    <div className="settingsPage__usageBar">
                      <span
                        className="settingsPage__usageFill"
                        style={{ width: "85%" }}
                      />
                    </div>
                  </div>
                  <div className="settingsPage__usageItem">
                    <div className="settingsPage__usageHeader">
                      <span>Team Members</span>
                      <span>4 / 10</span>
                    </div>
                    <div className="settingsPage__usageBar">
                      <span
                        className="settingsPage__usageFill settingsPage__usageFill--green"
                        style={{ width: "40%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {agentModalOpen && (
        <div
          className="settingsPage__modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agentModalTitle"
        >
          <div className="settingsPage__modal">
            <h2 id="agentModalTitle" className="settingsPage__modalTitle">
              {editingAgent ? "Edit Agent" : "Add Agent"}
            </h2>
            <form
              className="settingsPage__modalForm"
              onSubmit={handleSaveAgent}
            >
              <div className="settingsPage__formField">
                <label className="settingsPage__formLabel" htmlFor="agentName">
                  Name
                </label>
                <input
                  id="agentName"
                  type="text"
                  className="settingsPage__formInput"
                  value={agentForm.name}
                  onChange={(e) =>
                    setAgentForm((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                  placeholder="e.g. Research Agent"
                />
              </div>
              <div className="settingsPage__formField">
                <label className="settingsPage__formLabel" htmlFor="agentSlug">
                  Slug
                </label>
                <input
                  id="agentSlug"
                  type="text"
                  className="settingsPage__formInput"
                  value={agentForm.slug}
                  onChange={(e) =>
                    setAgentForm((p) => ({
                      ...p,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    }))
                  }
                  required
                  placeholder="e.g. research"
                />
              </div>
              <div className="settingsPage__formField">
                <label className="settingsPage__formLabel">
                  Model (backend)
                </label>
                <div className="settingsPage__fieldRow">
                  <select
                    className="settingsPage__formInput"
                    value={agentForm.backend}
                    onChange={(e) => {
                      const backend = e.target.value as AgentBackend;
                      setAgentForm((p) => ({
                        ...p,
                        backend,
                        model: AGENT_MODELS[backend][0].value,
                      }));
                    }}
                  >
                    {AGENT_BACKENDS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="settingsPage__formInput"
                    value={agentForm.model}
                    onChange={(e) =>
                      setAgentForm((p) => ({ ...p, model: e.target.value }))
                    }
                  >
                    {AGENT_MODELS[agentForm.backend].map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="settingsPage__formField">
                <label className="settingsPage__formLabel">Skills</label>
                <div className="settingsPage__skillsChips">
                  {AVAILABLE_SKILLS.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      className={`settingsPage__skillChip ${
                        agentForm.skills.includes(skill)
                          ? "settingsPage__skillChip--active"
                          : ""
                      }`}
                      onClick={() => toggleAgentSkill(skill)}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settingsPage__modalActions">
                <button
                  type="button"
                  className="settingsPage__btn settingsPage__btn--secondary"
                  onClick={() => setAgentModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settingsPage__btn settingsPage__btn--primary"
                  disabled={agentSaving}
                >
                  {agentSaving
                    ? "Saving…"
                    : editingAgent
                    ? "Save changes"
                    : "Add Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
