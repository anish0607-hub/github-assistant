"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

/** Generic one-click analysis panel (architecture summary, docs, commit analysis). */
export function AnalysisPanel({
  repositoryId,
  kind,
  title,
  description,
}: {
  repositoryId: string;
  kind: "architecture" | "docs" | "commits";
  title: string;
  description: string;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(force: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.analysis(kind, { repositoryId, force });
      setContent(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-zinc-100">{title}</h2>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
        <div className="flex gap-2">
          {content && (
            <Button variant="secondary" size="sm" onClick={() => run(true)} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </Button>
          )}
          {!content && (
            <Button size="sm" onClick={() => run(false)} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Generate
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      {busy && !content && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Analyzing the repository — this can take a minute…
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {content && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <Markdown>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
