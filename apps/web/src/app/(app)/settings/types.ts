export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role?: string | null;
};

export type SettingsSection =
  | "profile"
  | "apiKeys"
  | "workspace"
  | "team"
  | "agents"
  | "integrations"
  | "notifications"
  | "billing";

export type NavItem = {
  id: SettingsSection;
  label: string;
  icon: string;
};

export type SectionMeta = Record<
  SettingsSection,
  { title: string; subtitle: string }
>;

/** Workspace from API */
export type Workspace = {
  id: string;
  name: string;
};

/** Workspace member from API (profiles joined) */
export type WorkspaceMemberApi = {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

/** Display shape for team tab (derived from WorkspaceMemberApi) */
export type TeamMember = {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: string;
  roleTone: string;
  status: string;
};

/** Integration row from API */
export type IntegrationFromApi = {
  id: string;
  provider: string;
  status: string;
};

/** Integration card for UI (merged with provider display info) */
export type Integration = {
  id: string;
  provider: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  connected: boolean;
};

export type NotificationPrefs = {
  taskUpdates: boolean;
  agentActivity: boolean;
  weeklyDigest: boolean;
  desktopNotifications: boolean;
  soundAlerts: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  taskUpdates: true,
  agentActivity: true,
  weeklyDigest: false,
  desktopNotifications: true,
  soundAlerts: false,
};

/** Known integration providers with display info (key = provider id from DB) */
export const INTEGRATION_PROVIDERS: Record<
  string,
  { name: string; description: string; icon: string; color: string }
> = {
  github: {
    name: "GitHub",
    description: "Connect repositories and track commits",
    icon: "github",
    color: "#24292F",
  },
  slack: {
    name: "Slack",
    description: "Send notifications to Slack channels",
    icon: "message-circle",
    color: "#5865F2",
  },
  gcal: {
    name: "Google Calendar",
    description: "Sync tasks with your calendar",
    icon: "calendar",
    color: "#4285F4",
  },
  jira: {
    name: "Jira",
    description: "Import and sync Jira issues",
    icon: "trello",
    color: "#0052CC",
  },
};
