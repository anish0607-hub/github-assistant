"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { api, type SearchResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchPanel({ repositoryId }: { repositoryId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await api.search(repositoryId, query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <form onSubmit={run} className="mb-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Semantic search: 'jwt token validation', 'retry logic', …"
        />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex-1 space-y-3 overflow-y-auto">
        {results?.length === 0 && <p className="text-sm text-zinc-500">No matches found.</p>}
        {results?.map((r, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="font-mono text-xs text-accent">
                {r.path}:{r.startLine}–{r.endLine}
              </span>
              <span className="text-xs text-zinc-500">score {r.score.toFixed(3)}</span>
            </div>
            <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-zinc-300">
              <code>{r.content}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
