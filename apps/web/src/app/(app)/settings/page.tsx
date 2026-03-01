"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
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
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  const [activeSection, setActiveSection] = useState<"profile" | "workspace" | "team" | "agents" | "integrations" | "notifications" | "billing">("profile");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const workspaceId = typeof window !== "undefined" ? localStorage.getItem("agentos_workspace_id") || "" : "";

  const loadProfile = useCallback(async () => {
    try {
      const url = workspaceId ? `/profile?workspaceId=${workspaceId}` : "/profile";
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

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName || undefined })
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
    if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
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

  const navItems: { id: typeof activeSection; label: string; icon: string }[] = [
    { id: "profile", label: "Profile", icon: "user" },
    { id: "workspace", label: "Workspace", icon: "building" },
    { id: "team", label: "Team Members", icon: "users" },
    { id: "agents", label: "AI Agents", icon: "bot" },
    { id: "integrations", label: "Integrations", icon: "plug" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "billing", label: "Billing", icon: "credit-card" }
  ];

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
                className={`settingsPage__navItem ${activeSection === item.id ? "settingsPage__navItem--active" : ""}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="settingsPage__navIcon" data-icon={item.icon} aria-hidden />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="settingsPage__main">
          <header className="settingsPage__header">
            <h1 className="settingsPage__title">Profile Settings</h1>
            <p className="settingsPage__subtitle">
              Manage your personal information and account preferences.
            </p>
          </header>

          {activeSection === "profile" && (
            <>
              <section className="settingsPage__avatarSection">
                <div className="settingsPage__avatar" title={profile.full_name || profile.email}>
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="settingsPage__avatarImg" />
                  ) : (
                    <span className="settingsPage__avatarInitials">{initials}</span>
                  )}
                </div>
                <div className="settingsPage__avatarInfo">
                  <span className="settingsPage__avatarName">{profile.full_name || profile.email}</span>
                  <span className="settingsPage__avatarEmail">{profile.email}</span>
                  <span className="settingsPage__avatarRole">{formatRole(profile.role)}</span>
                </div>
                <button type="button" className="settingsPage__avatarUpload" disabled aria-label="Change photo">
                  <span className="settingsPage__avatarUploadIcon" aria-hidden />
                  Change photo
                </button>
              </section>

              <form className="settingsPage__form" onSubmit={handleSave}>
                <div className="settingsPage__formRow">
                  <div className="settingsPage__formField">
                    <label className="settingsPage__formLabel" htmlFor="firstName">
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
                    <label className="settingsPage__formLabel" htmlFor="lastName">
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
                  <label className="settingsPage__formLabel">Email address</label>
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
                  <Link href="/app" className="settingsPage__btn settingsPage__btn--secondary">
                    Cancel
                  </Link>
                  <button type="submit" className="settingsPage__btn settingsPage__btn--primary" disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>

              <div className="settingsPage__logoutSection">
                <button type="button" className="settingsPage__logoutBtn" onClick={handleLogout}>
                  <span className="settingsPage__logoutIcon" aria-hidden />
                  Log out
                </button>
              </div>

              <div className="settingsPage__dangerSection">
                <h3 className="settingsPage__dangerTitle">Testing: Delete account</h3>
                <p className="settingsPage__dangerText">
                  Permanently remove your profile and auth user. All your data will be deleted.
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

          {activeSection !== "profile" && (
            <p className="settingsPage__comingSoon">This section is coming soon.</p>
          )}
        </div>
      </div>
    </main>
  );
}
