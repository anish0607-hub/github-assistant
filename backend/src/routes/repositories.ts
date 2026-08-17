import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { dropCollection } from "../lib/qdrant";
import { parseRepoUrl, fetchRepoMetadata, fetchCommits } from "../services/github";
import { enqueueIndexJob } from "../queue";

export const repositoriesRouter = Router();

const importSchema = z.object({ url: z.string().min(3) });

// Import (or re-import) a repository and queue indexing
repositoriesRouter.post("/", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A repository URL is required" });

  try {
    const { owner, name } = parseRepoUrl(parsed.data.url);
    const meta = await fetchRepoMetadata(owner, name);

    const repo = await prisma.repository.upsert({
      where: { owner_name: { owner: meta.owner, name: meta.name } },
      create: {
        owner: meta.owner,
        name: meta.name,
        url: meta.url,
        defaultBranch: meta.defaultBranch,
        description: meta.description,
        language: meta.language,
        stars: meta.stars,
        status: "PENDING",
      },
      update: {
        defaultBranch: meta.defaultBranch,
        description: meta.description,
        language: meta.language,
        stars: meta.stars,
        status: "PENDING",
        error: null,
      },
    });

    await enqueueIndexJob(repo.id);
    res.status(201).json(repo);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

repositoriesRouter.get("/", async (_req, res) => {
  const repos = await prisma.repository.findMany({ orderBy: { createdAt: "desc" } });
  res.json(repos);
});

repositoriesRouter.get("/:id", async (req, res) => {
  const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
  if (!repo) return res.status(404).json({ error: "Repository not found" });
  res.json(repo);
});

repositoriesRouter.post("/:id/reindex", async (req, res) => {
  const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
  if (!repo) return res.status(404).json({ error: "Repository not found" });

  await prisma.repository.update({
    where: { id: repo.id },
    data: { status: "PENDING", error: null },
  });
  await prisma.analysisResult.deleteMany({ where: { repositoryId: repo.id } });
  await enqueueIndexJob(repo.id);
  res.json({ ok: true });
});

repositoriesRouter.delete("/:id", async (req, res) => {
  const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
  if (!repo) return res.status(404).json({ error: "Repository not found" });

  await dropCollection(repo.id);
  await prisma.repository.delete({ where: { id: repo.id } });
  res.json({ ok: true });
});

// File search within an indexed repository (name/path matching)
repositoriesRouter.get("/:id/files", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const files = await prisma.repositoryFile.findMany({
    where: {
      repositoryId: req.params.id,
      ...(q ? { path: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { path: "asc" },
    take: 200,
  });
  res.json(files);
});

// Recent commit history (live from the GitHub API)
repositoriesRouter.get("/:id/commits", async (req, res) => {
  const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
  if (!repo) return res.status(404).json({ error: "Repository not found" });
  try {
    const commits = await fetchCommits(repo.owner, repo.name, 50);
    res.json(commits);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "GitHub API error" });
  }
});
