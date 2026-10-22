import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

const text = (msg) => msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");

// One-shot call that returns JSON validated by the API against `schema`.
export async function askJson({ system, content, schema, effort = "low", max_tokens = 4000 }) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens,
    system,
    messages: [{ role: "user", content }],
    output_config: { effort, format: { type: "json_schema", schema } },
  });
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request");
  return JSON.parse(text(msg));
}

// Streams text deltas to `onText`; resolves with the full text.
export async function streamChat({ system, messages, onText, effort = "low", max_tokens = 1200 }) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens,
    system,
    messages,
    output_config: { effort },
  });
  stream.on("text", onText);
  const final = await stream.finalMessage();
  return text(final);
}
