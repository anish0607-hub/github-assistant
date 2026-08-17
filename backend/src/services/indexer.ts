import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { qdrant, collectionName, ensureCollection } from "../lib/qdrant";
import { downloadRepo } from "./github";
import { listSourceFiles } from "./files";
import { chunkFile } from "./chunker";
import { embedTexts, embeddingDimension } from "./embeddings";

const UPSERT_BATCH = 64;

export interface ChunkPayload {
  path: string;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
  [key: string]: unknown;
}

/**
 * Full indexing pipeline for a repository:
 * download tarball -> walk files -> chunk -> embed -> upsert into Qdrant.
 */
export async function indexRepository(repositoryId: string): Promise<void> {
  const repo = await prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { status: "INDEXING", error: null },
  });

  let checkoutDir: string | null = null;
  try {
    checkoutDir = await downloadRepo(repo.owner, repo.name, repo.defaultBranch);
    const files = await listSourceFiles(checkoutDir);

    await ensureCollection(repositoryId, embeddingDimension());
    await prisma.repositoryFile.deleteMany({ where: { repositoryId } });
    await prisma.repositoryFile.createMany({
      data: files.map((f) => ({
        repositoryId,
        path: f.relativePath,
        size: f.size,
        language: f.language,
      })),
    });

    let chunkCount = 0;
    let pending: { id: string; vectorText: string; payload: ChunkPayload }[] = [];

    const flush = async () => {
      if (pending.length === 0) return;
      const vectors = await embedTexts(pending.map((p) => p.vectorText));
      await qdrant.upsert(collectionName(repositoryId), {
        wait: true,
        points: pending.map((p, i) => ({
          id: p.id,
          vector: vectors[i],
          payload: p.payload,
        })),
      });
      chunkCount += pending.length;
      pending = [];
    };

    for (const file of files) {
      const content = await fs.promises.readFile(file.absolutePath, "utf8");
      const chunks = await chunkFile(content, file.language);
      for (const chunk of chunks) {
        pending.push({
          id: randomUUID(),
          // Prefix the path so retrieval matches on file names as well as code
          vectorText: `File: ${file.relativePath}\n\n${chunk.content}`,
          payload: {
            path: file.relativePath,
            language: file.language,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            content: chunk.content,
          },
        });
        if (pending.length >= UPSERT_BATCH) await flush();
      }
    }
    await flush();

    await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        status: "READY",
        fileCount: files.length,
        chunkCount,
        indexedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  } finally {
    if (checkoutDir) {
      await fs.promises.rm(checkoutDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
