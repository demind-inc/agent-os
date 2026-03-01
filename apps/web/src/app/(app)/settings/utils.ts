import type { TeamMember, WorkspaceMemberApi, IntegrationFromApi, Integration } from "./types";

export function getInitials(fullName: string | null, email: string): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return fullName.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export function formatRole(role: string | null | undefined): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const ROLE_TONE: Record<string, string> = {
  owner: "purple",
  editor: "blue",
  viewer: "gray",
};

export function memberApiToDisplay(m: WorkspaceMemberApi): TeamMember {
  const name = m.full_name?.trim() || m.email || "—";
  return {
    id: m.id,
    initials: getInitials(m.full_name, m.email),
    name,
    email: m.email,
    role: formatRole(m.role),
    roleTone: ROLE_TONE[m.role] ?? "gray",
    status: "Active",
  };
}

export function mergeIntegrationsForDisplay(
  fromApi: IntegrationFromApi[],
  providers: Record<string, { name: string; description: string; icon: string; color: string }>
): Integration[] {
  const byProvider = new Map(fromApi.map((i) => [i.provider, i]));
  return Object.entries(providers).map(([provider, info]) => {
    const row = byProvider.get(provider);
    return {
      id: row?.id ?? provider,
      provider,
      name: info.name,
      description: info.description,
      icon: info.icon,
      color: info.color,
      connected: row?.status === "connected",
    };
  });
}
