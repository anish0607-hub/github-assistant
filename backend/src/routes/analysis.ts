import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  architectureSummary,
  generateDocs,
  explainCode,
  detectBugs,
  analyzeCommits,
} from "../services/analysis";

export const analysisRouter = Router();

const repoSchema = z.object({
  repositoryId: z.string(),
  force: z.boolean().optional(),
});

const targetSchema = repoSchema.extend({ target: z.string().min(1) });

async function requireReadyRepo(repositoryId: string) {
  const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repo) throw Object.assign(new Error("Repository not found"), { status: 404 });
  if (repo.status !== "READY") {
    throw Object.assign(new Error("Repository is not indexed yet"), { status: 409 });
  }
  return repo;
}

function handle(fn: () => Promise<string>, res: import("express").Response) {
  fn()
    .then((content) => res.json({ content }))
    .catch((err) => {
      const status = typeof err?.status === "number" ? err.status : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : "Analysis failed" });
    });
}

analysisRouter.post("/architecture", (req, res) => {
  const parsed = repoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  handle(async () => {
    await requireReadyRepo(parsed.data.repositoryId);
    return architectureSummary(parsed.data.repositoryId, parsed.data.force);
  }, res);
});

analysisRouter.post("/docs", (req, res) => {
  const parsed = repoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  handle(async () => {
    await requireReadyRepo(parsed.data.repositoryId);
    return generateDocs(parsed.data.repositoryId, parsed.data.force);
  }, res);
});

analysisRouter.post("/explain", (req, res) => {
  const parsed = targetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  handle(async () => {
    await requireReadyRepo(parsed.data.repositoryId);
    return explainCode(parsed.data.repositoryId, parsed.data.target);
  }, res);
});

analysisRouter.post("/bugs", (req, res) => {
  const parsed = targetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  handle(async () => {
    await requireReadyRepo(parsed.data.repositoryId);
    return detectBugs(parsed.data.repositoryId, parsed.data.target);
  }, res);
});

analysisRouter.post("/commits", (req, res) => {
  const parsed = repoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  handle(async () => {
    const repo = await prisma.repository.findUnique({
      where: { id: parsed.data.repositoryId },
    });
    if (!repo) throw Object.assign(new Error("Repository not found"), { status: 404 });
    return analyzeCommits(parsed.data.repositoryId, parsed.data.force);
  }, res);
});
