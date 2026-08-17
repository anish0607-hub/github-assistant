import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { semanticSearch } from "../services/search";

export const searchRouter = Router();

const searchSchema = z.object({
  repositoryId: z.string(),
  query: z.string().min(1),
  limit: z.number().int().min(1).max(30).optional(),
});

searchRouter.post("/", async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const repo = await prisma.repository.findUnique({
    where: { id: parsed.data.repositoryId },
  });
  if (!repo) return res.status(404).json({ error: "Repository not found" });
  if (repo.status !== "READY") {
    return res.status(409).json({ error: "Repository is not indexed yet" });
  }

  try {
    const results = await semanticSearch(
      parsed.data.repositoryId,
      parsed.data.query,
      parsed.data.limit ?? 10
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Search failed" });
  }
});
