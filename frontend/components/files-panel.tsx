"use client";

import { useEffect, useState } from "react";
import { FileCode2, Loader2, Sparkles } from "lucide-react";
import { api, type RepositoryFile } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";

export function FilesPanel({ repositoryId }: { repositoryId: string }) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ path: string; content: string } | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      api.listFiles(repositoryId, query).then(setFiles).catch(() => setFiles([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [repositoryId, query]);

  async function explain(path: string) {
    setExplaining(path);
    setExplanation(null);
    try {
      const { content } = await api.analysis("explain", { repositoryId, target: path });
      setExplanation({ path, content });
    } catch (err) {
      setExplanation({
        path,
        content: `⚠️ ${err instanceof Error ? err.message : "Explanation failed"}`,
      });
    } finally {
      setExplaining(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter files by name or path…"
          className="mb-3"
        />
        <div className="flex-1 space-y-1 overflow-y-auto">
          {files.map((f) => (
            <div
              key={f.id}
              className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-border/30"
            >
              <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-zinc-300">
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span className="truncate">{f.path}</span>
              </span>
              <button
                onClick={() => explain(f.path)}
                disabled={explaining !== null}
                className="invisible flex items-center gap-1 text-xs text-accent group-hover:visible disabled:opacity-50"
              >
                {explaining === f.path ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Explain
              </button>
            </div>
          ))}
          {files.length === 0 && <p className="p-2 text-sm text-zinc-500">No files match.</p>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-surface p-4">
        {explanation ? (
          <>
            <p className="mb-3 font-mono text-xs text-accent">{explanation.path}</p>
            <Markdown>{explanation.content}</Markdown>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            Hover a file and press <span className="text-accent">Explain</span> to get an
            AI walkthrough of what it does.
          </p>
        )}
      </div>
    </div>
  );
}
