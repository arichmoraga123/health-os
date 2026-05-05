import Anthropic from "@anthropic-ai/sdk";

export const claudeModel = "claude-sonnet-4-5";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askClaude(prompt: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "AI key missing. Configure ANTHROPIC_API_KEY.";
  }
  const res = await client.messages.create({
    model: claudeModel,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .map((chunk) => ("text" in chunk ? chunk.text : ""))
    .join("")
    .trim();
}

export async function createClaudeMessage(opts: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}) {
  return client.messages.create({
    model: claudeModel,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });
}

export function streamClaude(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  return client.messages.stream({
    model: claudeModel,
    max_tokens: 1200,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
}
