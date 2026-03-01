import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
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
    github: ["github", "pull request", "pr", "repo", "commit", "merge"],
    todoist: ["todoist", "task sync", "todo", "checklist"],
    ui: ["ui", "design", "layout", "component", "frontend", "react"],
    docs: ["docs", "documentation", "readme", "write", "document"],
    api: ["api", "endpoint", "fastify", "backend", "integration"],
    "web-search": ["research", "search", "find", "look up", "synthesis", "summarize"],
    breakdown: ["plan", "break down", "steps", "timeline", "schedule", "milestone"],
    copy: ["copy", "marketing", "blog", "content", "write", "draft"]
  };

  const lower = description.toLowerCase();
  return Object.entries(dictionary)
    .filter(([, terms]) => terms.some((term) => lower.includes(term)))
    .map(([skill]) => skill);
}
