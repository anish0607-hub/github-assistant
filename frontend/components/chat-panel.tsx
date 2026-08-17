"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { streamChat, type ChatSource } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export function ChatPanel({ repositoryId }: { repositoryId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationRef = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    const appendToAssistant = (updater: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = updater(next[next.length - 1]);
        return next;
      });
    };

    await streamChat(
      { repositoryId, conversationId: conversationRef.current, message },
      {
        onMeta: (meta) => {
          conversationRef.current = meta.conversationId;
          appendToAssistant((m) => ({ ...m, sources: meta.sources }));
        },
        onText: (delta) => appendToAssistant((m) => ({ ...m, content: m.content + delta })),
        onError: (msg) =>
          appendToAssistant((m) => ({
            ...m,
            content: m.content || `⚠️ ${msg}`,
          })),
        onDone: () => {},
      }
    );

    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-16 text-center text-sm text-zinc-500">
            <p className="mb-2 text-base text-zinc-400">Ask anything about this codebase</p>
            <p>&quot;How does authentication work?&quot; · &quot;Where is the API defined?&quot; ·
            &quot;Explain the data model&quot;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                msg.role === "user"
                  ? "max-w-[80%] rounded-lg bg-accent/20 px-4 py-2 text-sm text-zinc-100"
                  : "max-w-[90%] rounded-lg border border-border bg-surface px-4 py-3"
              }
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <>
                  {msg.content ? (
                    <Markdown>{msg.content}</Markdown>
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2">
                      {msg.sources.map((s, j) => (
                        <span
                          key={j}
                          className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
                          title={`lines ${s.startLine}–${s.endLine}`}
                        >
                          {s.path}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about the codebase… (Enter to send)"
            rows={2}
            className="resize-none"
          />
          <Button onClick={send} disabled={busy || !input.trim()} className="self-end">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
