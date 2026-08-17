import { qdrant, collectionName } from "../lib/qdrant";
import { embedQuery } from "./embeddings";
import type { ChunkPayload } from "./indexer";

export interface SearchResult {
  path: string;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

/** Semantic search over a repository's indexed chunks. */
export async function semanticSearch(
  repositoryId: string,
  query: string,
  limit = 8
): Promise<SearchResult[]> {
  const vector = await embedQuery(query);
  const response = await qdrant.query(collectionName(repositoryId), {
    query: vector,
    limit,
    with_payload: true,
  });

  return response.points.map((hit) => {
    const payload = hit.payload as unknown as ChunkPayload;
    return {
      path: payload.path,
      language: payload.language,
      startLine: payload.startLine,
      endLine: payload.endLine,
      content: payload.content,
      score: hit.score,
    };
  });
}

/** Formats retrieved chunks as a context block for LLM prompts. */
export function formatContext(results: SearchResult[]): string {
  return results
    .map(
      (r, i) =>
        `### Source ${i + 1}: ${r.path} (lines ${r.startLine}-${r.endLine})\n` +
        "```" + (r.language ?? "") + "\n" + r.content + "\n```"
    )
    .join("\n\n");
}
