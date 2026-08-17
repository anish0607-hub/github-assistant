"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Github, Loader2, Search, Star, Trash2 } from "lucide-react";
import { api, type Repository } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export default function HomePage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRepos(await api.listRepos());
    } catch {
      // backend not reachable yet — keep whatever we have
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setImporting(true);
    setError(null);
    try {
      await api.importRepo(url.trim());
      setUrl("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this repository and its index?")) return;
    await api.deleteRepo(id);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-3 text-accent">
          <Github className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
          GitHub Knowledge Assistant
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          Paste any GitHub repository URL and instantly chat with the codebase —
          semantic search, explanations, docs, bug detection and commit analysis.
        </p>
      </div>

      <form onSubmit={handleImport} className="mx-auto mb-4 flex max-w-2xl gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo or owner/repo"
          className="h-11"
        />
        <Button type="submit" size="lg" disabled={importing}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Import
        </Button>
      </form>
      {error && <p className="mb-6 text-center text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {repos.map((repo) => (
          <Card key={repo.id} className="transition-colors hover:border-accent/50">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  <Link href={`/repo/${repo.id}`} className="hover:text-accent">
                    {repo.owner}/{repo.name}
                  </Link>
                </CardTitle>
                <StatusBadge status={repo.status} />
              </div>
              {repo.description && (
                <p className="line-clamp-2 text-sm text-zinc-400">{repo.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <div className="flex items-center gap-3">
                  {repo.language && <span>{repo.language}</span>}
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3" /> {repo.stars.toLocaleString()}
                  </span>
                  {repo.status === "READY" && (
                    <span>
                      {repo.fileCount} files · {repo.chunkCount} chunks
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(repo.id)}
                  className="text-zinc-600 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {repo.status === "FAILED" && repo.error && (
                <p className="mt-2 text-xs text-red-400">{repo.error}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {repos.length === 0 && (
        <p className="mt-8 text-center text-sm text-zinc-500">
          No repositories yet — import one above to get started.
        </p>
      )}
    </main>
  );
}
