import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { askJson, MODEL, live, status, checkKey } from "./claude.js";
import { evaluate, defaultRules, policies, FIELDS, OPS } from "./rules.js";
import { heroClaim, receipts as sampleReceipts, SAMPLE_CLAIM_PACK } from "./fixtures.js";
import * as store from "./claims.js";
import { listLeads, sentEmails, updateLead, resetCrm, findLead, createLead, sendEmail } from "./crm.js";
import { runAssistant, suggestions } from "./assistant.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const json = (f) => JSON.parse(read("data", f));
const app = express();
app.use(express.json({ limit: "40mb" }));

// ---- hardcoded demo accounts (demo only: no real authentication) ----
const ACCOUNTS = [
  { email: "ramon@workforcesolution.demo", password: "customer123", role: "customer", name: "Ramon A. Dela Cruz", token: "demo-customer" },
  { email: "angelo@workforcesolution.demo", password: "agent123", role: "agent", name: "Angelo Reyes", token: "demo-agent" },
  { email: "maricar@workforcesolution.demo", password: "executive123", role: "executive", name: "Maricar Ocampo", token: "demo-executive" },
  { email: "elena@workforcesolution.demo", password: "manager123", role: "manager", name: "Elena Marquez", token: "demo-manager" },
];
const byToken = (t) => ACCOUNTS.find((a) => a.token === t);
const needs = (...roles) => (req, res, next) => {
  const a = byToken(req.get("x-token"));
  if (!a || !roles.includes(a.role)) return res.status(401).json({ error: "Please sign in again" });
  req.user = a;
  next();
};

app.get("/api/health", (_req, res) => res.json({ ok: true, ai: { ...status, live: live() } }));
app.post("/api/login", (req, res) => {
  const a = ACCOUNTS.find((x) => x.email === String(req.body.email || "").trim().toLowerCase() && x.password === req.body.password);
  if (!a) return res.status(401).json({ error: "Wrong email or password" });
  res.json({ token: a.token, role: a.role, name: a.name, email: a.email });
});

// ---- static ----
app.use(express.static(path.join(root, "public")));
app.use("/files/claim", express.static(path.join(root, "data/claims/hero-claim")));
const uploads = new Map(); // "CLM-id/filename" -> { mediaType, buf }
app.get("/files/uploads/:id/:name", (req, res) => {
  const u = uploads.get(req.params.id + "/" + req.params.name);
  if (!u) return res.status(404).end();
  res.type(u.mediaType).send(u.buf);
});
app.use("/files/receipts", express.static(path.join(root, "data/receipts")));

const fail = (res, e) => {
  console.error(e);
  res.status(500).json({ error: e?.message || "Unexpected error" });
};
const fileBlock = (f) =>
  f.mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
    : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } };

// =====================================================================
// Customer portal
// =====================================================================
const customer = needs("customer");

app.get("/api/customer/bootstrap", customer, (_req, res) => {
  res.json({
    policy: policies[0],
    claimFiles: fs.readdirSync(path.join(root, "data/claims/hero-claim")).filter((f) => f.endsWith(".pdf")).sort(),
    receiptFiles: fs.readdirSync(path.join(root, "data/receipts")).filter((f) => f.endsWith(".pdf")).sort(),
  });
});

const str = { type: "string" };
const claimSchema = {
  type: "object", additionalProperties: false,
  required: ["documents", "fields", "normalized"],
  properties: {
    documents: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["filename", "doc_type", "summary"],
        properties: { filename: str, doc_type: { type: "string", enum: ["claim_form", "or_cr", "drivers_license", "police_report", "repair_estimate", "other"] }, summary: str },
      },
    },
    fields: {
      type: "array",
      description: "Every key fact read from the documents, shown to the customer for confirmation",
      items: {
        type: "object", additionalProperties: false, required: ["key", "label", "value", "confidence", "source_doc", "source_quote"],
        properties: { key: str, label: str, value: str, confidence: { type: "number", description: "0 to 1" }, source_doc: { type: "string", description: "filename the value was read from" }, source_quote: { type: "string", description: "short verbatim text from the document" } },
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
        loss_location: str, license_expiry: { type: "string", description: "YYYY-MM-DD" }, repair_shop: str,
        estimate_total: { type: "number", description: "Total repair estimate in PHP" },
        damage_categories_note: str,
        damage_category: { type: "string", enum: ["front_collision", "rear_collision", "side_collision", "theft", "flood", "fire", "other"] },
        damage_areas: { type: "array", items: str },
      },
    },
  },
};

// `sample` returns the canned hero claim; the browser plays the reading animation.
// Real uploads go to Claude; if it is unavailable the customer is pointed at the sample pack instead of seeing wrong data.
app.post("/api/claims/extract", customer, async (req, res) => {
  try {
    if (req.body.sample === SAMPLE_CLAIM_PACK) return res.json({ ...heroClaim, source: "sample" });
    const files = req.body.files || [];
    if (!files.length) return res.status(400).json({ error: "No files" });
    if (!live()) return res.status(503).json({ error: "The AI reader is offline in this demo. Use the sample claim pack to see the full experience.", offline: true });
    const content = [];
    for (const f of files) content.push({ type: "text", text: `Document filename: ${f.name}` }, fileBlock(f));
    content.push({
      type: "text",
      text: "These documents make up one motor insurance claim submission. Classify each document, read every key fact into `fields` (claimant, policy no., vehicle, plate, chassis/engine, date and place of loss, narrative summary, driver, license no. and expiry, police blotter no., repair shop and TIN, estimate no. and total, etc.) with a 0-1 confidence and the filename and a short verbatim quote it came from, and fill `normalized` with machine-readable values (dates as YYYY-MM-DD, amounts as numbers). Use empty string or 0 when a value is not present. Do not invent anything.",
    });
    const result = await askJson({
      system: "You are a claims intake assistant for a Philippine non-life insurer. You read claim documents accurately and never guess.",
      content, schema: claimSchema, effort: "low", max_tokens: 6000,
    });
    res.json({ ...result, source: "live" });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: "The AI reader could not finish in time. Try again, or use the sample claim pack.", offline: true });
  }
});

// Claims the customer has submitted live on the server, so executives and managers see them too.
app.get("/api/customer/claims", customer, (_req, res) => {
  res.json(store.allClaims().filter((c) => c.source === "customer").sort((a, b) => b.id.localeCompare(a.id)).map(store.customerSummary));
});
app.get("/api/customer/claims/:id", customer, (req, res) => {
  const c = store.getClaim(req.params.id);
  if (!c || c.source !== "customer") return res.status(404).json({ error: "Claim not found" });
  res.json(store.customerView(c));
});
app.post("/api/customer/claims", customer, (req, res) => {
  try {
    const next = 1042 + store.allClaims().filter((c) => c.source === "customer").length;
    const id = "CLM-2026-" + next;
    const saved = (req.body.files || []).map((f) => {
      if (f.sample) return { name: f.name, size: f.size, slot: f.slot, url: "/files/claim/" + f.name };
      uploads.set(id + "/" + f.name, { mediaType: f.mediaType || "application/octet-stream", buf: Buffer.from(f.data || "", "base64") });
      return { name: f.name, size: f.size, slot: f.slot, url: "/files/uploads/" + id + "/" + encodeURIComponent(f.name) };
    });
    const c = store.createCustomerClaim(req.body, saved);
    res.json(store.customerView(c));
  } catch (e) { fail(res, e); }
});
app.post("/api/customer/claims/:id/receipt", customer, (req, res) => {
  const c = store.getClaim(req.params.id);
  if (!c || c.source !== "customer") return res.status(404).json({ error: "Claim not found" });
  store.attachReceipt(c, req.body.receipt);
  res.json(store.customerView(c));
});

// Customer-safe view of the internal checks: which documents are missing and whether the policy was in force.
app.post("/api/claims/check", customer, (req, res) => {
  try {
    const ev = evaluate(req.body.claim, defaultRules);
    const r01 = ev.results.find((r) => r.id === "R01");
    res.json({
      checklist: ev.checklist,
      policy: ev.policy && { policy_no: ev.policy.policy_no, product: ev.policy.product, inception: ev.policy.inception, expiry: ev.policy.expiry },
      inForce: r01?.status === "pass",
      note: r01?.detail || "",
    });
  } catch (e) { fail(res, e); }
});

const receiptSchema = {
  type: "object", additionalProperties: false,
  required: ["is_receipt", "document_type", "vendor_name", "vendor_tin", "vendor_address", "invoice_no", "date", "line_items", "subtotal", "vat", "total", "payment_method", "checks", "confidence", "notes"],
  properties: {
    is_receipt: { type: "boolean" }, document_type: str, vendor_name: str, vendor_tin: str, vendor_address: str, invoice_no: str,
    date: { type: "string", description: "YYYY-MM-DD, empty if unreadable" },
    line_items: { type: "array", items: { type: "object", additionalProperties: false, required: ["description", "qty", "amount"], properties: { description: str, qty: { type: "number" }, amount: { type: "number" } } } },
    subtotal: { type: "number" }, vat: { type: "number" }, total: { type: "number" }, payment_method: str,
    checks: { type: "array", description: "Validity checks for a Philippine BIR-style receipt: TIN present, invoice/OR number present, date present, total present, line items sum to total", items: { type: "object", additionalProperties: false, required: ["check", "passed", "note"], properties: { check: str, passed: { type: "boolean" }, note: str } } },
    confidence: { type: "number" }, notes: str,
  },
};

app.post("/api/receipts/extract", customer, async (req, res) => {
  try {
    if (req.body.sample) {
      const r = sampleReceipts[req.body.sample];
      return r ? res.json({ ...r, source: "sample" }) : res.status(404).json({ error: "Unknown sample" });
    }
    const f = req.body.file;
    if (!f) return res.status(400).json({ error: "No file" });
    if (!live()) return res.status(503).json({ error: "The AI reader is offline in this demo. Try one of the sample receipts.", offline: true });
    const result = await askJson({
      system: "You extract data from receipts and invoices (Philippine context, amounts in PHP) accurately and never guess. Use 0 or empty string for anything not present on the document.",
      content: [fileBlock(f), { type: "text", text: "Extract this receipt. If it is not a receipt or invoice, set is_receipt false." }],
      schema: receiptSchema, effort: "low", max_tokens: 3000,
    });
    res.json({ ...result, source: "live" });
  } catch (e) {
    console.error(e);
    res.status(503).json({ error: "The AI reader could not finish in time. Try again, or use a sample receipt.", offline: true });
  }
});

// =====================================================================
// Claim executive and claim manager
// =====================================================================
const staff = needs("executive", "manager");
const detail = (c) => ({ ...store.listRow(c), normalized: c.normalized, fields: c.fields, documents: c.documents, docFiles: c.docFiles, checklist: c.checklist, receipt: c.receipt, incident: c.incident, evaluation: c.evaluation, narrative: c.narrative, history: c.history, escalation: c.escalation, decision: c.decision });

app.get("/api/claims/:id", staff, (req, res) => {
  const c = store.getClaim(req.params.id);
  return c ? res.json(detail(c)) : res.status(404).json({ error: "Claim not found" });
});
app.post("/api/claims/:id/decision", staff, (req, res) => {
  const c = store.getClaim(req.params.id);
  if (!c) return res.status(404).json({ error: "Claim not found" });
  if (req.user.role === "executive" && c.assignee !== req.user.name) return res.status(403).json({ error: "This claim is assigned to " + c.assignee });
  const err = store.decide(c, req.user.name, req.user.role, req.body);
  return err ? res.status(400).json({ error: err }) : res.json(detail(c));
});
app.get("/api/executive/claims", needs("executive"), (req, res) => {
  res.json(store.allClaims().filter((c) => c.assignee === req.user.name).sort((a, b) => b.received.localeCompare(a.received) || b.id.localeCompare(a.id)).map(store.listRow));
});
app.get("/api/manager/overview", needs("manager"), (_req, res) => {
  const rows = store.allClaims().sort((a, b) => b.received.localeCompare(a.received) || b.id.localeCompare(a.id)).map(store.listRow);
  const people = store.EXECUTIVES.map((e) => {
    const mine = rows.filter((r) => r.assignee === e.name);
    return { name: e.name, open: mine.filter((r) => ["New", "In review", "Documents requested"].includes(r.status)).length, escalated: mine.filter((r) => r.status === "Escalated").length, decided: mine.filter((r) => ["Approved", "Rejected", "Paid"].includes(r.status)).length, total: mine.length };
  });
  res.json({ rows, people, manager: store.MANAGER });
});
app.get("/api/manager/rules", needs("manager"), (_req, res) => res.json({ ...store.ruleState, defaults: defaultRules.rules, fields: FIELDS, ops: OPS }));
app.put("/api/manager/rules", needs("manager"), (req, res) => {
  const rules = req.body.rules;
  const ACTIONS = ["approve", "review", "escalate", "decline"];
  if (!Array.isArray(rules)) return res.status(400).json({ error: "Rules are required" });
  for (const r of rules) {
    if (!r.id || !String(r.name || "").trim()) return res.status(400).json({ error: "Every rule needs a name" });
    if (!ACTIONS.includes(r.action)) return res.status(400).json({ error: `${r.id}: unknown action` });
    if (!(Number(r.weight) >= 0 && Number(r.weight) <= 100)) return res.status(400).json({ error: `${r.id}: weight must be between 0 and 100` });
    if (r.custom) {
      const f = FIELDS.find((x) => x.key === r.cond?.field);
      if (!f) return res.status(400).json({ error: `${r.id}: pick a field for the condition` });
      if (!OPS[f.type].includes(r.cond.op)) return res.status(400).json({ error: `${r.id}: that comparison does not fit ${f.label}` });
      if (String(r.cond.value ?? "").trim() === "" || (f.type === "number" && Number.isNaN(Number(r.cond.value)))) return res.status(400).json({ error: `${r.id}: enter a value for the condition` });
    }
    if (r.param && !(Number(r.param.value) >= 0)) return res.status(400).json({ error: `${r.id}: ${r.param.label} must be a number` });
  }
  if (new Set(rules.map((r) => r.id)).size !== rules.length) return res.status(400).json({ error: "Rule ids must be unique" });
  const clean = rules.map((r) => ({ ...r, enabled: !!r.enabled, weight: Number(r.weight), ...(r.param ? { param: { ...r.param, value: Number(r.param.value) } } : {}) }));
  const out = store.publishRules(clean, String(req.body.note || "").slice(0, 200), req.user.name);
  res.json({ ...out, state: { ...store.ruleState } });
});
app.post("/api/manager/rules/reset", needs("manager"), (_req, res) => {
  const out = store.publishRules(structuredClone(defaultRules.rules), "Reset to default rules", "Elena Marquez");
  res.json({ ...out, state: { ...store.ruleState } });
});

// =====================================================================
// Agent portal (CRM + assistant)
// =====================================================================
const agent = needs("agent");

app.get("/api/crm/leads", agent, (_req, res) => res.json({ leads: listLeads(), emails: sentEmails() }));
app.patch("/api/crm/leads/:id", agent, (req, res) => {
  const l = findLead(req.params.id);
  if (!l) return res.status(404).json({ error: "Lead not found" });
  const r = updateLead({ lead: l.id, ...req.body });
  if (r.error) return res.status(400).json({ error: r.error });
  res.json({ lead: l });
});
app.post("/api/crm/leads", agent, (req, res) => {
  if (!String(req.body.name || "").trim()) return res.status(400).json({ error: "Name is required" });
  const r = createLead(req.body);
  res.json(r.result);
});
app.post("/api/crm/emails", agent, (req, res) => {
  const r = sendEmail(req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  res.json(r.result);
});
app.post("/api/crm/reset", agent, (_req, res) => { resetCrm(); res.json({ leads: listLeads(), emails: sentEmails() }); });
app.get("/api/crm/suggestions", agent, (_req, res) => res.json(suggestions));
app.get("/api/products", agent, (_req, res) => res.json(json("catalog.json")));

app.post("/api/crm/chat", agent, async (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const emit = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  try {
    await runAssistant({ messages: req.body.messages || [], scenario: req.body.scenario, emit });
  } catch (e) {
    console.error(e);
    emit({ t: "\n\nSomething went wrong on my side. Please try again." });
    emit({ done: true, mode: "demo" });
  }
  res.end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Workforce Solution demo on http://localhost:${port} (model ${MODEL})`);
  if (!status.configured) console.log("AI: ANTHROPIC_API_KEY is not set, running in demo mode (built-in demo items only)");
  else if (status.forcedDemo) console.log("AI: DEMO_MODE=1, using built-in demo items only");
  else checkKey().then(() => console.log(status.ok ? `AI: key OK, ${MODEL} answered in ${status.ms} ms` : `AI: key check FAILED (${status.error}); falling back to demo items`));
});
