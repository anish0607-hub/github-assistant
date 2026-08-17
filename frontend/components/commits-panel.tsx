"use client";

import { useEffect, useState } from "react";
import { GitCommitHorizontal, Loader2, Sparkles } from "lucide-react";
import { api, type CommitInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

export function CommitsPanel({ repositoryId }: { repositoryId: string }) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCommits(repositoryId).then(setCommits).catch(() => setCommits([]));
  }, [repositoryId]);

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.analysis("commits", { repositoryId, force: analysis !== null });
      setAnalysis(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-100">Recent commits</h2>
          <Button size="sm" onClick={analyze} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Analyze history
          </Button>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {commits.map((c) => (
            <a
              key={c.sha}
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-border bg-surface px-3 py-2 hover:border-accent/50"
            >
              <div className="flex items-center gap-2 text-sm text-zinc-200">
                <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span className="truncate">{c.message.split("\n")[0]}</span>
              </div>
              <p className="mt-0.5 pl-5 text-xs text-zinc-500">
                <span className="font-mono">{c.sha.slice(0, 7)}</span> · {c.author} ·{" "}
                {c.date ? new Date(c.date).toLocaleDateString() : ""}
              </p>
            </a>
          ))}
          {commits.length === 0 && <p className="text-sm text-zinc-500">No commits loaded.</p>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-surface p-4">
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        {analysis ? (
          <Markdown>{analysis}</Markdown>
        ) : (
          <p className="text-sm text-zinc-500">
            Press <span className="text-accent">Analyze history</span> to get an AI summary of
            recent development activity — themes, cadence and notable changes.
          </p>
        )}
      </div>
    </div>
  );
}
