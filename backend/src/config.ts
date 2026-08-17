import "dotenv/config";

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(env("PORT", "4000"), 10),
  databaseUrl: env("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/github_assistant"),
  redisUrl: env("REDIS_URL", "redis://localhost:6379"),
  qdrantUrl: env("QDRANT_URL", "http://localhost:6333"),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: env("ANTHROPIC_MODEL", "claude-opus-5"),

  embeddingsProvider: env("EMBEDDINGS_PROVIDER", "openai") as "openai" | "voyage",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  voyageApiKey: process.env.VOYAGE_API_KEY ?? "",
  embeddingsModel: process.env.EMBEDDINGS_MODEL ?? "",

  githubToken: process.env.GITHUB_TOKEN ?? "",
};
