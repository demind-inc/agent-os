import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const adminSupabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function getUserFromBearer(authHeader?: string) {
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await adminSupabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function assertWorkspaceMember(userId: string, workspaceId: string) {
  const { data, error } = await adminSupabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Workspace access denied");
  }
}

export async function detectSkillsFromDescription(description: string) {
  const dictionary: Record<string, string[]> = {
    github: ["github", "pull request", "pr", "repo"],
    todoist: ["todoist", "task sync", "todo"],
    ui: ["ui", "design", "layout", "component"],
    docs: ["docs", "documentation", "readme"],
    api: ["api", "endpoint", "fastify", "backend"]
  };

  const lower = description.toLowerCase();
  return Object.entries(dictionary)
    .filter(([, terms]) => terms.some((term) => lower.includes(term)))
    .map(([skill]) => skill);
}
