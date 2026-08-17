import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { semanticSearch, formatContext } from "../services/search";
import { streamCompletion, ChatTurn } from "../services/llm";

export const chatRouter = Router();

const chatSchema = z.object({
  repositoryId: z.string(),
  conversationId: z.string().optional(),
  message: z.string().min(1),
});

const CHAT_SYSTEM = `You are an expert engineer answering questions about a specific GitHub
repository. Ground every answer in the retrieved source excerpts provided in the user's message.
Cite file paths (and line numbers when helpful). If the excerpts don't contain the answer, say
what's missing instead of guessing. Answer in Markdown; keep responses focused and concise.`;

// Streaming RAG chat over an indexed repository (SSE)
chatRouter.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { repositoryId, message } = parsed.data;

  const repo = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repo) return res.status(404).json({ error: "Repository not found" });
  if (repo.status !== "READY") {
    return res.status(409).json({ error: "Repository is not indexed yet" });
  }

  // Find or create the conversation
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const exists = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!exists) conversationId = null;
  }
  if (!conversationId) {
    const conversation = await prisma.conversation.create({
      data: { repositoryId, title: message.slice(0, 80) },
    });
    conversationId = conversation.id;
  }

  await prisma.message.create({
    data: { conversationId, role: "user", content: message },
  });

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // Retrieve relevant code for the latest question
  const results = await semanticSearch(repositoryId, message, 8);
  const context = formatContext(results);

  const turns: ChatTurn[] = history.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  turns.push({
    role: "user",
    content: `Repository: ${repo.owner}/${repo.name}\n\nRetrieved source excerpts:\n${context}\n\nQuestion: ${message}`,
  });

  // SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("meta", {
    conversationId,
    sources: results.map((r) => ({ path: r.path, startLine: r.startLine, endLine: r.endLine })),
  });

  try {
    const fullText = await streamCompletion({
      system: CHAT_SYSTEM,
      messages: turns,
      maxTokens: 8000,
      onText: (delta) => send("text", { delta }),
    });

    await prisma.message.create({
      data: { conversationId, role: "assistant", content: fullText },
    });
    send("done", { conversationId });
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : "Chat failed" });
  } finally {
    res.end();
  }
});

// Conversation history
chatRouter.get("/conversations/:repositoryId", async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { repositoryId: req.params.repositoryId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  res.json(conversations);
});
