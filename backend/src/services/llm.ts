import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Streams a Claude response, invoking onText for each text delta.
 * Returns the full response text once the stream completes.
 */
export async function streamCompletion(options: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  onText: (delta: string) => void;
}): Promise<string> {
  const stream = client.messages.stream({
    model: config.anthropicModel,
    max_tokens: options.maxTokens ?? 16000,
    system: options.system,
    messages: options.messages,
  });

  stream.on("text", (delta) => options.onText(delta));

  const final = await stream.finalMessage();
  return final.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/** Non-interactive completion (analysis endpoints). Streams internally to avoid HTTP timeouts. */
export async function complete(options: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const stream = client.messages.stream({
    model: config.anthropicModel,
    max_tokens: options.maxTokens ?? 16000,
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
  });
  const final = await stream.finalMessage();

  if (final.stop_reason === "refusal") {
    throw new Error("The model declined to answer this request.");
  }

  return final.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
