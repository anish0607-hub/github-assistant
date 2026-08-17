import { Badge } from "@/components/ui/badge";
import type { RepoStatus } from "@/lib/api";

const LABELS: Record<RepoStatus, { label: string; variant: "success" | "warning" | "error" | "muted" }> = {
  PENDING: { label: "Queued", variant: "muted" },
  INDEXING: { label: "Indexing…", variant: "warning" },
  READY: { label: "Ready", variant: "success" },
  FAILED: { label: "Failed", variant: "error" },
};

export function StatusBadge({ status }: { status: RepoStatus }) {
  const { label, variant } = LABELS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
