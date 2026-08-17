import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import * as tar from "tar";
import { config } from "../config";

const API = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-knowledge-assistant",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.githubToken) h.Authorization = `Bearer ${config.githubToken}`;
  return h;
}

export interface ParsedRepo {
  owner: string;
  name: string;
}

/** Accepts full URLs (https://github.com/owner/repo), SSH URLs, or "owner/repo". */
export function parseRepoUrl(input: string): ParsedRepo {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");

  const urlMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (urlMatch) return { owner: urlMatch[1], name: urlMatch[2] };

  const shortMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shortMatch) return { owner: shortMatch[1], name: shortMatch[2] };

  throw new Error(`Could not parse GitHub repository from "${input}"`);
}

export interface RepoMetadata {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  stars: number;
}

export async function fetchRepoMetadata(owner: string, name: string): Promise<RepoMetadata> {
  const res = await fetch(`${API}/repos/${owner}/${name}`, { headers: headers() });
  if (res.status === 404) {
    throw new Error(`Repository ${owner}/${name} not found (is it private? set GITHUB_TOKEN)`);
  }
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as any;
  return {
    owner: data.owner.login,
    name: data.name,
    url: data.html_url,
    defaultBranch: data.default_branch ?? "main",
    description: data.description ?? null,
    language: data.language ?? null,
    stars: data.stargazers_count ?? 0,
  };
}

/**
 * Downloads the repository tarball and extracts it into a temp directory.
 * Returns the path of the directory containing the repository contents.
 */
export async function downloadRepo(owner: string, name: string, branch: string): Promise<string> {
  const res = await fetch(`${API}/repos/${owner}/${name}/tarball/${branch}`, {
    headers: headers(),
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download tarball for ${owner}/${name}: HTTP ${res.status}`);
  }

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gh-repo-"));
  await pipeline(Readable.fromWeb(res.body as any), tar.x({ cwd: dir }));

  // GitHub tarballs contain a single top-level directory like owner-repo-sha/
  const entries = await fs.promises.readdir(dir);
  if (entries.length === 1) {
    return path.join(dir, entries[0]);
  }
  return dir;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export async function fetchCommits(owner: string, name: string, limit = 50): Promise<CommitInfo[]> {
  const res = await fetch(`${API}/repos/${owner}/${name}/commits?per_page=${limit}`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as any[];
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit?.message ?? "",
    author: c.commit?.author?.name ?? c.author?.login ?? "unknown",
    date: c.commit?.author?.date ?? "",
    url: c.html_url ?? "",
  }));
}
