import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "../config";

export const qdrant = new QdrantClient({ url: config.qdrantUrl });

export function collectionName(repositoryId: string): string {
  return `repo_${repositoryId}`;
}

export async function ensureCollection(repositoryId: string, dimension: number): Promise<void> {
  const name = collectionName(repositoryId);
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === name);
  if (exists) {
    // Recreate so re-indexing starts clean
    await qdrant.deleteCollection(name);
  }
  await qdrant.createCollection(name, {
    vectors: { size: dimension, distance: "Cosine" },
  });
}

export async function dropCollection(repositoryId: string): Promise<void> {
  const name = collectionName(repositoryId);
  try {
    await qdrant.deleteCollection(name);
  } catch {
    // collection may not exist — nothing to do
  }
}
