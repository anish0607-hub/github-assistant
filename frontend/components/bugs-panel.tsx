"use client";

import { useState } from "react";
import { Bug, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";

export function BugsPanel({ repositoryId }: { repositoryId: string }) {
  const [target, setTarget] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.analysis("bugs", { repositoryId, target: target.trim() });
      setContent(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bug analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4">
        <h2 className="font-semibold text-zinc-100">Bug Detection</h2>
        <p className="text-sm text-zinc-500">
          Point the reviewer at a file path or an area of the codebase (e.g. &quot;auth
          middleware&quot;, &quot;src/utils/date.ts&quot;).
        </p>
      </div>

      <form onSubmit={run} className="mb-4 flex gap-2">
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="File path or topic to review…"
        />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
          Review
        </Button>
      </form>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

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
