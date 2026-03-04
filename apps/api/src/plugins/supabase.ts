import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
  );
}

export const adminSupabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const AGENTOS_KEY_PREFIX = "ag_";

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export async function getUserFromBearer(authHeader?: string) {
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return null;
  if (token.startsWith(AGENTOS_KEY_PREFIX)) {
    const apiKeyAuth = await getApiKeyAuth(token);
    if (!apiKeyAuth) return null;
    return {
      id: apiKeyAuth.userId,
      apiKeyProjectId: apiKeyAuth.projectId,
    } as any;
  }
  const { data, error } = await adminSupabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export interface ApiKeyAuth {
  userId: string;
  projectId: string;
}

export async function getApiKeyAuth(
  rawKey: string
): Promise<ApiKeyAuth | null> {
  if (!rawKey.startsWith(AGENTOS_KEY_PREFIX)) return null;
  const keyHash = hashApiKey(rawKey);
  const { data, error } = await adminSupabase
    .from("agentos_api_keys")
    .select("user_id, project_id")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (error || !data) return null;
  return { userId: data.user_id, projectId: data.project_id };
}

export async function assertWorkspaceMember(
  userId: string,
  workspaceId: string
) {
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
    "web-search": [
      "research",
      "search",
      "find",
      "look up",
      "synthesis",
      "summarize",
    ],
    breakdown: [
      "plan",
      "break down",
      "steps",
      "timeline",
      "schedule",
      "milestone",
    ],
    copy: ["copy", "marketing", "blog", "content", "write", "draft"],
  };

  const lower = description.toLowerCase();
  return Object.entries(dictionary)
    .filter(([, terms]) => terms.some((term) => lower.includes(term)))
    .map(([skill]) => skill);
}
