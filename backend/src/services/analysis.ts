import { prisma } from "../lib/prisma";
import { semanticSearch, formatContext } from "./search";
import { complete } from "./llm";
import { fetchCommits } from "./github";

const SYSTEM = `You are a senior software engineer helping a developer understand a codebase.
Base your answers on the provided source excerpts. When you reference code, cite file paths
(and line numbers when useful). If the excerpts are insufficient to answer confidently, say so.
Format your response in Markdown.`;

async function getRepo(repositoryId: string) {
  return prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });
}

async function cached(
  repositoryId: string,
  type: string,
  key: string,
  generate: () => Promise<string>,
  force = false
): Promise<string> {
  if (!force) {
    const existing = await prisma.analysisResult.findUnique({
      where: { repositoryId_type_key: { repositoryId, type, key } },
    });
    if (existing) return existing.content;
  }
  const content = await generate();
  await prisma.analysisResult.upsert({
    where: { repositoryId_type_key: { repositoryId, type, key } },
    create: { repositoryId, type, key, content },
    update: { content, createdAt: new Date() },
  });
  return content;
}

/** High-level architecture summary of the repository. */
export async function architectureSummary(repositoryId: string, force = false): Promise<string> {
  return cached(repositoryId, "architecture", "", async () => {
    const repo = await getRepo(repositoryId);
    const files = await prisma.repositoryFile.findMany({
      where: { repositoryId },
      orderBy: { path: "asc" },
      take: 400,
    });
    const fileTree = files.map((f) => f.path).join("\n");

    const queries = [
      "application entry point main initialization setup",
      "core business logic domain model",
      "configuration routing API endpoints",
    ];
    const contexts = await Promise.all(queries.map((q) => semanticSearch(repositoryId, q, 5)));
    const context = formatContext(contexts.flat());

    const prompt = `Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "n/a"} | Primary language: ${repo.language ?? "n/a"}

File tree (up to 400 files):
${fileTree}

Representative source excerpts:
${context}

Write an architecture summary of this repository covering:
1. What the project does (one paragraph)
2. High-level architecture and main components/modules
3. Key technologies, frameworks and libraries
4. How data/control flows through the system
5. Directory structure guide (what lives where)`;

    return complete({ system: SYSTEM, prompt });
  }, force);
}

/** Auto-generated developer documentation. */
export async function generateDocs(repositoryId: string, force = false): Promise<string> {
  return cached(repositoryId, "docs", "", async () => {
    const repo = await getRepo(repositoryId);
    const queries = [
      "public API exported functions interface",
      "setup installation configuration environment variables",
      "usage examples how to run",
    ];
    const contexts = await Promise.all(queries.map((q) => semanticSearch(repositoryId, q, 6)));
    const context = formatContext(contexts.flat());

    const prompt = `Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "n/a"}

Source excerpts:
${context}

Generate developer documentation for this repository in Markdown, including:
- Overview
- Getting started (setup, configuration, environment variables found in the code)
- Key modules and their responsibilities
- Public APIs / main entry points with short usage notes
Only document what is supported by the excerpts; note gaps explicitly.`;

    return complete({ system: SYSTEM, prompt });
  }, force);
}

/** Explains a file or an arbitrary question about the code. */
export async function explainCode(repositoryId: string, target: string): Promise<string> {
  const results = await semanticSearch(repositoryId, target, 8);
  const context = formatContext(results);

  const prompt = `The developer asked for an explanation of: "${target}"

Relevant source excerpts:
${context}

Explain clearly what this code does, how it works, and anything non-obvious
(edge cases, side effects, dependencies on other parts of the codebase).`;

  return complete({ system: SYSTEM, prompt });
}

/** Heuristic bug review of code related to a file path or topic. */
export async function detectBugs(repositoryId: string, target: string): Promise<string> {
  const results = await semanticSearch(repositoryId, target, 8);
  const context = formatContext(results);

  const prompt = `Review the following source excerpts for potential bugs.

Target: "${target}"

${context}

Report every issue you find, including ones you are uncertain about or consider low-severity.
For each finding include: file path and line range, a one-sentence description of the defect,
a concrete scenario where it misbehaves, estimated severity (high/medium/low), and your confidence.
If you find no plausible issues in the excerpts, say so plainly.`;

  return complete({ system: SYSTEM, prompt });
}

/** Summarizes and analyzes recent commit history. */
export async function analyzeCommits(repositoryId: string, force = false): Promise<string> {
  return cached(repositoryId, "commits", "", async () => {
    const repo = await getRepo(repositoryId);
    const commits = await fetchCommits(repo.owner, repo.name, 50);
    const log = commits
      .map((c) => `${c.date} | ${c.author} | ${c.sha.slice(0, 7)} | ${c.message.split("\n")[0]}`)
      .join("\n");

    const prompt = `Recent commit history for ${repo.owner}/${repo.name} (newest first):

${log}

Analyze this history:
1. What has the team been working on recently? Group commits into themes.
2. Development activity patterns (cadence, contributors, focus areas)
3. Any signals worth noting (large refactors, hotfix streaks, dependency churn)`;

    return complete({ system: SYSTEM, prompt });
  }, force);
}
