import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { askJson, streamChat, MODEL } from "./claude.js";
import { evaluate, defaultRules, history } from "./rules.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const app = express();
app.use(express.json({ limit: "40mb" }));

// ---- optional passcode (the Cloudflare URL is public and API calls cost money) ----
const PASSCODE = process.env.DEMO_PASSCODE;
app.use("/api", (req, res, next) => {
  if (!PASSCODE || req.path === "/health" || req.get("x-passcode") === PASSCODE) return next();
  res.status(401).json({ error: "passcode" });
});
app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL, passcode: !!PASSCODE }));

// ---- static ----
app.use(express.static(path.join(root, "public")));
app.use("/files/claim", express.static(path.join(root, "data/claims/hero-claim")));
app.use("/files/receipts", express.static(path.join(root, "data/receipts")));
app.get("/api/bootstrap", (_req, res) => {
  const j = (f) => JSON.parse(read("data", f));
  res.json({
    queue: j("queue_seed.json"),
    rules: defaultRules,
    personas: j("personas.json"),
    seed: j("sessions_seed.json"),
    history,
    claimFiles: fs.readdirSync(path.join(root, "data/claims/hero-claim")).filter((f) => f.endsWith(".pdf")).sort(),
    receiptFiles: fs.readdirSync(path.join(root, "data/receipts")).filter((f) => f.endsWith(".pdf")).sort(),
  });
});

const fail = (res, e) => {
  console.error(e);
  res.status(500).json({ error: e?.message || "Unexpected error" });
};
const fileBlock = (f) =>
  f.mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
    : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } };

// ---- Claims: extraction ----
const str = { type: "string" };
const claimSchema = {
  type: "object",
  additionalProperties: false,
  required: ["documents", "fields", "normalized"],
  properties: {
    documents: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["filename", "doc_type", "summary"],
        properties: {
          filename: str,
          doc_type: { type: "string", enum: ["claim_form", "or_cr", "drivers_license", "police_report", "repair_estimate", "other"] },
          summary: str,
        },
      },
    },
    fields: {
      type: "array",
      description: "Every key fact read from the documents, for display to the adjuster",
      items: {
        type: "object", additionalProperties: false,
        required: ["key", "label", "value", "confidence", "source_doc", "source_quote"],
        properties: {
          key: str, label: str, value: str,
          confidence: { type: "number", description: "0 to 1" },
          source_doc: { type: "string", description: "filename the value was read from" },
          source_quote: { type: "string", description: "short verbatim text from the document" },
        },
      },
    },
    normalized: {
      type: "object", additionalProperties: false,
      required: ["policy_no", "claimant_name", "driver_name", "plate_no", "vehicle_model", "loss_date", "reported_date", "loss_location", "license_expiry", "repair_shop", "estimate_total", "damage_categories_note", "damage_category", "damage_areas"],
      properties: {
        policy_no: str, claimant_name: str, driver_name: str, plate_no: str,
        vehicle_model: { type: "string", description: "Make and model only, e.g. 'Toyota Vios'" },
        loss_date: { type: "string", description: "YYYY-MM-DD" },
        reported_date: { type: "string", description: "YYYY-MM-DD date the claim was reported to the insurer" },
        loss_location: str,
        license_expiry: { type: "string", description: "YYYY-MM-DD" },
        repair_shop: str,
        estimate_total: { type: "number", description: "Total repair estimate in PHP" },
        damage_categories_note: str,
        damage_category: { type: "string", enum: ["front_collision", "rear_collision", "side_collision", "theft", "flood", "fire", "other"] },
        damage_areas: { type: "array", items: str },
      },
    },
  },
};

app.post("/api/claims/extract", async (req, res) => {
  try {
    const files = req.body.files || [];
    if (!files.length) return res.status(400).json({ error: "No files" });
    const content = [];
    for (const f of files) {
      content.push({ type: "text", text: `Document filename: ${f.name}` }, fileBlock(f));
    }
    content.push({
      type: "text",
      text: "These documents make up one motor insurance claim submission. Classify each document, read every key fact into `fields` (claimant, policy no., vehicle, plate, chassis/engine, date and place of loss, narrative summary, driver, license no. and expiry, police blotter no., repair shop and TIN, estimate no. and total, etc.) with a 0-1 confidence and the filename and a short verbatim quote it came from, and fill `normalized` with machine-readable values (dates as YYYY-MM-DD, amounts as numbers). Use empty string or 0 when a value is not present. Do not invent anything.",
    });
    const result = await askJson({
      system: "You are a claims intake assistant for a Philippine non-life insurer. You read claim documents accurately and never guess.",
      content, schema: claimSchema, effort: "low", max_tokens: 6000,
    });
    res.json(result);
  } catch (e) { fail(res, e); }
});

// ---- Claims: rules (instant) and narration (LLM) ----
app.post("/api/claims/evaluate", (req, res) => {
  try { res.json(evaluate(req.body.claim, req.body.rules || defaultRules)); } catch (e) { fail(res, e); }
});

const narrativeSchema = {
  type: "object", additionalProperties: false,
  required: ["summary", "flag_reasons", "recommendation"],
  properties: {
    summary: { type: "string", description: "2 to 3 sentences for the adjuster" },
    flag_reasons: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["rule_id", "reasoning"], properties: { rule_id: str, reasoning: str } },
    },
    recommendation: str,
  },
};

app.post("/api/claims/narrate", async (req, res) => {
  try {
    const { claim, evaluation } = req.body;
    const brief = {
      claim: claim.normalized,
      receipt: claim.receipt || null,
      score: evaluation.score, band: evaluation.band, recommended_action: evaluation.outcome,
      rules: evaluation.results.filter((r) => r.status === "fail").map(({ id, name, detail, action }) => ({ id, name, detail, action })),
      passed: evaluation.results.filter((r) => r.status === "pass").map(({ id, name, detail }) => ({ id, name, detail })),
    };
    const result = await askJson({
      system: "You write the AI assessment shown to a claims adjuster at a Philippine insurer. Be factual, specific, and calm; the facts below come from a deterministic rule engine, so do not add facts or change the score. Never accuse anyone of fraud; describe indicators that warrant review. For each fired rule, write 1 to 2 plain-language sentences explaining why it matters here, using the concrete details given.",
      content: [{ type: "text", text: JSON.stringify(brief, null, 1) }],
      schema: narrativeSchema, effort: "low", max_tokens: 2000,
    });
    res.json(result);
  } catch (e) { fail(res, e); }
});

// ---- Receipts ----
const receiptSchema = {
  type: "object", additionalProperties: false,
  required: ["is_receipt", "document_type", "vendor_name", "vendor_tin", "vendor_address", "invoice_no", "date", "line_items", "subtotal", "vat", "total", "payment_method", "checks", "confidence", "notes"],
  properties: {
    is_receipt: { type: "boolean" },
    document_type: { type: "string", description: "e.g. Sales Invoice, Official Receipt, Hospital Statement of Account" },
    vendor_name: str, vendor_tin: str, vendor_address: str, invoice_no: str,
    date: { type: "string", description: "YYYY-MM-DD, empty if unreadable" },
    line_items: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["description", "qty", "amount"], properties: { description: str, qty: { type: "number" }, amount: { type: "number" } } },
    },
    subtotal: { type: "number" }, vat: { type: "number" }, total: { type: "number" },
    payment_method: str,
    checks: {
      type: "array",
      description: "Validity checks for a Philippine BIR-style receipt: TIN present, invoice/OR number present, date present, total present, line items sum to total",
      items: { type: "object", additionalProperties: false, required: ["check", "passed", "note"], properties: { check: str, passed: { type: "boolean" }, note: str } },
    },
    confidence: { type: "number" },
    notes: str,
  },
};

app.post("/api/receipts/extract", async (req, res) => {
  try {
    const f = req.body.file;
    if (!f) return res.status(400).json({ error: "No file" });
    const result = await askJson({
      system: "You extract data from receipts and invoices (Philippine context, amounts in PHP) accurately and never guess. Use 0 or empty string for anything not present on the document.",
      content: [fileBlock(f), { type: "text", text: "Extract this receipt. If it is not a receipt or invoice, set is_receipt false." }],
      schema: receiptSchema, effort: "low", max_tokens: 3000,
    });
    res.json(result);
  } catch (e) { fail(res, e); }
});

// ---- Academy ----
const productDocs = () =>
  fs.readdirSync(path.join(root, "data/products")).sort()
    .map((f) => `<document name="${f}">\n${read("data/products", f)}\n</document>`).join("\n\n");
const personaText = (p) =>
  `${p.name}, ${p.age}. ${p.tagline}.\nScenario: ${p.scenario}\nBackground: ${p.background}\nObjections you may raise: ${(p.objections || []).join("; ")}`;
const personas = () => JSON.parse(read("data/personas.json"));

app.post("/api/coach/chat", async (req, res) => {
  try {
    const { mode, personaId, messages } = req.body;
    let system;
    if (mode === "qa") system = read("server/prompts/qa.md").replace("{{DOCS}}", productDocs());
    else {
      const persona = personas().find((p) => p.id === personaId) || personas()[0];
      system = read("server/prompts/roleplay.md")
        .replace("{{PERSONA}}", personaText(persona))
        .replace("{{PRODUCT}}", read("data/products/personal-accident.md"));
    }
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    try {
      await streamChat({ system, messages, onText: (t) => send({ t }), effort: "low" });
      send({ done: true });
    } catch (e) { console.error(e); send({ error: e.message }); }
    res.end();
  } catch (e) { fail(res, e); }
});

const scoreSchema = {
  type: "object", additionalProperties: false,
  required: ["criteria", "objections", "strengths", "improvements", "rewrite", "summary"],
  properties: {
    criteria: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["name", "score", "comment", "quote"], properties: { name: str, score: { type: "integer" }, comment: str, quote: str } },
    },
    objections: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["objection", "handled", "comment"], properties: { objection: str, handled: { type: "boolean" }, comment: str } },
    },
    strengths: { type: "array", items: str },
    improvements: { type: "array", items: str },
    rewrite: { type: "object", additionalProperties: false, required: ["original", "better", "why"], properties: { original: str, better: str, why: str } },
    summary: str,
  },
};

app.post("/api/coach/score", async (req, res) => {
  try {
    const { personaId, messages } = req.body;
    const persona = personas().find((p) => p.id === personaId) || personas()[0];
    const transcript = messages.map((m) => `${m.role === "user" ? "AGENT" : "CUSTOMER"}: ${m.content}`).join("\n");
    const system = read("server/prompts/score.md")
      .replace("{{PERSONA}}", personaText(persona))
      .replace("{{PRODUCT}}", read("data/products/personal-accident.md"))
      .replace("{{TRANSCRIPT}}", transcript);
    const result = await askJson({
      system, content: "Evaluate the agent now.", schema: scoreSchema, effort: "medium", max_tokens: 3500,
    });
    result.criteria = result.criteria.map((c) => ({ ...c, score: Math.max(0, Math.min(20, c.score)) }));
    result.total = result.criteria.reduce((s, c) => s + c.score, 0);
    res.json(result);
  } catch (e) { fail(res, e); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Pioneer demo on http://localhost:${port} (model ${MODEL}${PASSCODE ? ", passcode on" : ""})`));
