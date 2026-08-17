"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  FileCode2,
  GitCommitHorizontal,
  Landmark,
  Loader2,
  MessageSquare,
  NotebookText,
  RefreshCw,
  Search,
} from "lucide-react";
import { api, type Repository } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { ChatPanel } from "@/components/chat-panel";
import { SearchPanel } from "@/components/search-panel";
import { FilesPanel } from "@/components/files-panel";
import { AnalysisPanel } from "@/components/analysis-panel";
import { BugsPanel } from "@/components/bugs-panel";
import { CommitsPanel } from "@/components/commits-panel";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "search", label: "Code Search", icon: Search },
  { id: "files", label: "Files", icon: FileCode2 },
  { id: "architecture", label: "Architecture", icon: Landmark },
  { id: "docs", label: "Docs", icon: NotebookText },
  { id: "bugs", label: "Bugs", icon: Bug },
  { id: "commits", label: "Commits", icon: GitCommitHorizontal },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function RepoPage() {
  const params = useParams<{ id: string }>();
  const repositoryId = params.id;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [tab, setTab] = useState<TabId>("chat");

  const refresh = useCallback(async () => {
    try {
      setRepo(await api.getRepo(repositoryId));
    } catch {
      // keep last known state
    }
  }, [repositoryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while indexing
  useEffect(() => {
    if (repo && (repo.status === "PENDING" || repo.status === "INDEXING")) {
      const interval = setInterval(refresh, 3000);
      return () => clearInterval(interval);
    }
  }, [repo, refresh]);

  if (!repo) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const ready = repo.status === "READY";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-semibold text-zinc-100">
              {repo.owner}/{repo.name}
            </h1>
            <p className="text-xs text-zinc-500">
              {repo.language ?? "—"} · {repo.fileCount} files · {repo.chunkCount} indexed chunks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={repo.status} />
          <button
            onClick={async () => {
              await api.reindexRepo(repo.id);
              refresh();
            }}
            title="Re-index"
            className="text-zinc-500 hover:text-zinc-300"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-400">
          {repo.status === "FAILED" ? (
            <>
              <p className="text-red-400">Indexing failed</p>
              {repo.error && <p className="max-w-lg text-center text-sm">{repo.error}</p>}
            </>
          ) : (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Indexing repository — downloading, chunking and embedding the code…</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border p-3">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  tab === id
                    ? "bg-accent/15 text-accent"
                    : "text-zinc-400 hover:bg-border/40 hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <main className="min-h-0 min-w-0 flex-1">
            {tab === "chat" && <ChatPanel repositoryId={repo.id} />}
            {tab === "search" && <SearchPanel repositoryId={repo.id} />}
            {tab === "files" && <FilesPanel repositoryId={repo.id} />}
            {tab === "architecture" && (
              <AnalysisPanel
                repositoryId={repo.id}
                kind="architecture"
                title="Architecture Summary"
                description="High-level overview of components, data flow and structure."
              />
            )}
            {tab === "docs" && (
              <AnalysisPanel
                repositoryId={repo.id}
                kind="docs"
                title="Auto Documentation"
                description="Generated developer docs: setup, modules and key APIs."
              />
            )}
            {tab === "bugs" && <BugsPanel repositoryId={repo.id} />}
            {tab === "commits" && <CommitsPanel repositoryId={repo.id} />}
          </main>
        </div>
      )}
    </div>
  );
}
