/**
 * GitHub API tools for the agent. Uses the access_token from the workspace's
 * integration (connected via Settings → Integrations). Mirrors MCP-style
 * GitHub capabilities.
 */

const GITHUB_API = "https://api.github.com";

async function ghFetch(
  path: string,
  accessToken: string,
  opts?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method: opts?.method ?? "GET",
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${accessToken}`,
        ...(opts?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { message?: string }).message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function githubSearchRepositories(
  accessToken: string,
  query: string,
  limit = 10
): Promise<string> {
  const { ok, data, error } = await ghFetch(
    `/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`,
    accessToken
  );
  if (!ok) return `Error: ${error}`;
  const items = ((data as { items?: unknown[] })?.items ?? []).slice(0, limit);
  return JSON.stringify(
    items.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        full_name: rec.full_name,
        description: rec.description,
        html_url: rec.html_url,
        stargazers_count: rec.stargazers_count,
        language: rec.language,
      };
    }),
    null,
    2
  );
}

export async function githubGetFile(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string> {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const { ok, data, error } = await ghFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}${q}`,
    accessToken
  );
  if (!ok) return `Error: ${error}`;
  const d = data as { content?: string; encoding?: string };
  if (d.content) {
    const decoded = Buffer.from(d.content, (d.encoding as BufferEncoding) ?? "base64").toString("utf-8");
    return decoded;
  }
  return JSON.stringify(data, null, 2);
}

export async function githubListIssues(
  accessToken: string,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
  limit = 20
): Promise<string> {
  const { ok, data, error } = await ghFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${state}&per_page=${limit}`,
    accessToken
  );
  if (!ok) return `Error: ${error}`;
  const items = (Array.isArray(data) ? data : []).slice(0, limit);
  return JSON.stringify(
    items.map((i) => {
      const rec = i as Record<string, unknown>;
      return {
        number: rec.number,
        title: rec.title,
        state: rec.state,
        html_url: rec.html_url,
        user: (rec.user as Record<string, unknown>)?.login,
        created_at: rec.created_at,
      };
    }),
    null,
    2
  );
}

export async function githubListRepos(accessToken: string, limit = 30): Promise<string> {
  const { ok, data, error } = await ghFetch(
    `/user/repos?per_page=${limit}&sort=updated`,
    accessToken
  );
  if (!ok) return `Error: ${error}`;
  const items = (Array.isArray(data) ? data : []).slice(0, limit);
  return JSON.stringify(
    items.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        full_name: rec.full_name,
        description: rec.description,
        html_url: rec.html_url,
        private: rec.private,
      };
    }),
    null,
    2
  );
}

export async function githubListBranches(
  accessToken: string,
  owner: string,
  repo: string,
  limit = 30
): Promise<string> {
  const { ok, data, error } = await ghFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${limit}`,
    accessToken
  );
  if (!ok) return `Error: ${error}`;
  const items = (Array.isArray(data) ? data : []).slice(0, limit);
  return JSON.stringify(
    items.map((b) => {
      const rec = b as Record<string, unknown>;
      const commit = rec.commit as Record<string, unknown> | undefined;
      return {
        name: rec.name,
        protected: rec.protected,
        commit_sha: commit?.sha,
      };
    }),
    null,
    2
  );
}

export async function githubListCommits(
  accessToken: string,
  owner: string,
  repo: string,
  sha?: string,
  limit = 20
): Promise<string> {
  const params = new URLSearchParams({ per_page: String(limit) });
  if (sha) params.set("sha", sha);
  const { ok, data, error } = await ghFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params}`,
    accessToken
  );
  if (!ok) return `Error: ${error}`;
  const items = (Array.isArray(data) ? data : []).slice(0, limit);
  return JSON.stringify(
    items.map((c) => {
      const rec = c as Record<string, unknown>;
      const commit = rec.commit as Record<string, unknown> | undefined;
      const author = commit?.author as Record<string, unknown> | undefined;
      const user = rec.author as Record<string, unknown> | undefined;
      return {
        sha: (rec.sha as string)?.slice(0, 7),
        message: (commit?.message as string)?.split("\n")[0],
        author: author?.name ?? user?.login,
        date: author?.date,
        html_url: rec.html_url,
      };
    }),
    null,
    2
  );
}

export async function githubCreatePullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body?: string
): Promise<string> {
  const { ok, data, error } = await ghFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
    accessToken,
    {
      method: "POST",
      body: { title, head, base, ...(body ? { body } : {}) },
    }
  );
  if (!ok) return `Error: ${error}`;
  const pr = data as { html_url?: string; number?: number; title?: string };
  return JSON.stringify(
    {
      html_url: pr.html_url,
      number: pr.number,
      title: pr.title,
      message: `Pull request #${pr.number} created: ${pr.html_url}`,
    },
    null,
    2
  );
}

export type GitHubToolName =
  | "github_search_repositories"
  | "github_get_file"
  | "github_list_issues"
  | "github_list_repos"
  | "github_list_branches"
  | "github_list_commits"
  | "github_create_pull_request";

export async function executeGitHubTool(
  name: GitHubToolName,
  accessToken: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "github_search_repositories": {
      const q = String(input.query ?? "").trim();
      if (!q) return "Error: query is required";
      return githubSearchRepositories(accessToken, q, Number(input.limit) || 10);
    }
    case "github_get_file": {
      const owner = String(input.owner ?? "").trim();
      const repo = String(input.repo ?? "").trim();
      const path = String(input.path ?? "").trim();
      if (!owner || !repo || !path) return "Error: owner, repo, and path are required";
      return githubGetFile(accessToken, owner, repo, path, input.ref as string | undefined);
    }
    case "github_list_issues": {
      const owner = String(input.owner ?? "").trim();
      const repo = String(input.repo ?? "").trim();
      if (!owner || !repo) return "Error: owner and repo are required";
      return githubListIssues(
        accessToken,
        owner,
        repo,
        (input.state as "open" | "closed" | "all") ?? "open",
        Number(input.limit) || 20
      );
    }
    case "github_list_repos": {
      return githubListRepos(accessToken, Number(input.limit) || 30);
    }
    case "github_list_branches": {
      const owner = String(input.owner ?? "").trim();
      const repo = String(input.repo ?? "").trim();
      if (!owner || !repo) return "Error: owner and repo are required";
      return githubListBranches(
        accessToken,
        owner,
        repo,
        Number(input.limit) || 30
      );
    }
    case "github_list_commits": {
      const owner = String(input.owner ?? "").trim();
      const repo = String(input.repo ?? "").trim();
      if (!owner || !repo) return "Error: owner and repo are required";
      return githubListCommits(
        accessToken,
        owner,
        repo,
        input.sha as string | undefined,
        Number(input.limit) || 20
      );
    }
    case "github_create_pull_request": {
      const owner = String(input.owner ?? "").trim();
      const repo = String(input.repo ?? "").trim();
      const title = String(input.title ?? "").trim();
      const head = String(input.head ?? "").trim();
      const base = String(input.base ?? "main").trim();
      if (!owner || !repo || !title || !head) {
        return "Error: owner, repo, title, and head are required";
      }
      return githubCreatePullRequest(
        accessToken,
        owner,
        repo,
        title,
        head,
        base,
        input.body as string | undefined
      );
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
