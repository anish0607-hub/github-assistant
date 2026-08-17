import { config } from "../config";

interface ProviderConfig {
  url: string;
  apiKey: string;
  model: string;
  dimension: number;
}

function provider(): ProviderConfig {
  if (config.embeddingsProvider === "voyage") {
    if (!config.voyageApiKey) throw new Error("VOYAGE_API_KEY is not set");
    return {
      url: "https://api.voyageai.com/v1/embeddings",
      apiKey: config.voyageApiKey,
      model: config.embeddingsModel || "voyage-code-3",
      dimension: 1024,
    };
  }
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not set");
  return {
    url: "https://api.openai.com/v1/embeddings",
    apiKey: config.openaiApiKey,
    model: config.embeddingsModel || "text-embedding-3-small",
    dimension: 1536,
  };
}

export function embeddingDimension(): number {
  return provider().dimension;
}

const BATCH_SIZE = 64;

/** Embeds a list of texts, batching requests to the provider. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { url, apiKey, model } = provider();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) {
      throw new Error(`Embeddings API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) vectors.push(item.embedding);
  }

  return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}
