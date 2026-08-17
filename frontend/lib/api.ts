export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type RepoStatus = "PENDING" | "INDEXING" | "READY" | "FAILED";

export interface Repository {
  id: string;
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  stars: number;
  status: RepoStatus;
  error: string | null;
  fileCount: number;
  chunkCount: number;
  indexedAt: string | null;
  createdAt: string;
}

export interface RepositoryFile {
  id: string;
  path: string;
  size: number;
  language: string | null;
}

export interface SearchResult {
  path: string;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface ChatSource {
  path: string;
  startLine: number;
  endLine: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  importRepo: (url: string) =>
    request<Repository>("/api/repositories", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  listRepos: () => request<Repository[]>("/api/repositories"),
  getRepo: (id: string) => request<Repository>(`/api/repositories/${id}`),
  reindexRepo: (id: string) =>
    request<{ ok: true }>(`/api/repositories/${id}/reindex`, { method: "POST" }),
  deleteRepo: (id: string) =>
    request<{ ok: true }>(`/api/repositories/${id}`, { method: "DELETE" }),
  listFiles: (id: string, q: string) =>
    request<RepositoryFile[]>(`/api/repositories/${id}/files?q=${encodeURIComponent(q)}`),
  listCommits: (id: string) => request<CommitInfo[]>(`/api/repositories/${id}/commits`),
  search: (repositoryId: string, query: string) =>
    request<SearchResult[]>("/api/search", {
      method: "POST",
      body: JSON.stringify({ repositoryId, query }),
    }),
  analysis: (
    kind: "architecture" | "docs" | "explain" | "bugs" | "commits",
    body: { repositoryId: string; target?: string; force?: boolean }
  ) =>
    request<{ content: string }>(`/api/analysis/${kind}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export interface ChatStreamHandlers {
  onMeta?: (meta: { conversationId: string; sources: ChatSource[] }) => void;
  onText: (delta: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

/** Consumes the SSE chat stream from the backend. */
export async function streamChat(
  body: { repositoryId: string; conversationId?: string; message: string },
  handlers: ChatStreamHandlers
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    handlers.onError((err as { error?: string }).error ?? `Chat failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processEvent = (block: string) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (event === "meta") handlers.onMeta?.(parsed);
      else if (event === "text") handlers.onText(parsed.delta);
      else if (event === "error") handlers.onError(parsed.message);
      else if (event === "done") handlers.onDone();
    } catch {
      // ignore malformed frames
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (block.trim()) processEvent(block);
    }
  }
}
