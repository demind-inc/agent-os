/**
 * Fetches GitHub integration (access_token) for a workspace from the database.
 * Used by the agent executor to access GitHub on behalf of the user who connected
 * the integration in Settings → Integrations.
 */

import { adminSupabase } from "../plugins/supabase.js";

export type GitHubIntegration = {
  id: string;
  access_token: string;
};

export async function getGitHubIntegrationForWorkspace(
  workspaceId: string
): Promise<GitHubIntegration | null> {
  const { data, error } = await adminSupabase
    .from("integrations")
    .select("id, access_token")
    .eq("workspace_id", workspaceId)
    .eq("provider", "github")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !data?.access_token) return null;
  return data as GitHubIntegration;
}
