import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
export const configured = !!process.env.ANTHROPIC_API_KEY;
export const forcedDemo = process.env.DEMO_MODE === "1";
// Short timeout and one retry: a slow or failing call must fall back to the demo data quickly instead of hanging the UI.
export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "missing", timeout: 40000, maxRetries: 1 });

// Result of the startup key check, shown in the UI and in /api/health.
export const status = { configured, forcedDemo, ok: null, error: null, ms: null, model: MODEL };
export const live = () => configured && !forcedDemo && status.ok !== false;

export async function checkKey() {
  if (!configured || forcedDemo) return;
  const t0 = Date.now();
  try {
    await client.messages.create({ model: MODEL, max_tokens: 8, messages: [{ role: "user", content: "Reply with OK" }] });
    status.ok = true; status.error = null;
  } catch (e) {
    status.ok = false; status.error = e?.message || String(e);
  }
  status.ms = Date.now() - t0;
}

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
