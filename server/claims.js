// Shared in-memory claims store and rule set. Customers create claims here, claim executives work them,
// the claim manager oversees them and edits the fraud rules. Resets when the server restarts.
import { evaluate, defaultRules, ACTION_LABEL } from "./rules.js";

export const EXECUTIVES = [
  { name: "Maricar Ocampo", email: "maricar@workforcesolution.demo" },
  { name: "Jun Sarmiento", email: "jun@workforcesolution.demo" },
];
export const MANAGER = "Elena Marquez";
export const NEW_CLAIM_ASSIGNEE = EXECUTIVES[0].name; // the demo executive who signs in
export const STATUSES = ["New", "In review", "Documents requested", "Escalated", "Approved", "Rejected", "Paid"];
const OPEN = ["New", "In review", "Documents requested"];
export const isFinal = (s) => ["Approved", "Rejected", "Paid"].includes(s);

const stamp = () => new Date().toISOString();
const addDays = (iso, n) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const band = (s) => (s >= 60 ? "High" : s >= 30 ? "Medium" : "Low");
const priority = (s) => (s >= 60 ? "High" : s >= 30 ? "Medium" : "Low");

// ---------------- rules ----------------
export const ruleState = { version: 1, rules: [], log: [] };
export function resetRules() {
  ruleState.version = 1;
  ruleState.rules = structuredClone(defaultRules.rules);
  ruleState.log = [{ version: 1, at: stamp(), by: "System", note: "Default rule set loaded", changes: [] }];
}
export const currentRuleset = () => ({ version: defaultRules.version, rules: ruleState.rules });

// ---------------- narrative (deterministic, so it works without an API key) ----------------
const WHY = {
  R01: "The policy was not in force or the premium was unpaid on the date of loss, which is a condition for any payout.",
  R02: "A late notice makes the loss harder to verify.",
  R03: "Required documents are missing, so the claim cannot be assessed yet.",
  R04: "The driver is not on the policy's authorised list or the license was not valid.",
  R06: "The repair estimate is well above what this repair normally costs.",
  R07: "The loss happened soon after the policy started. Early claims are a common indicator and deserve a closer look.",
  R08: "The same vehicle already has a claim for similar damage in the lookback window. The earlier repair may never have been completed.",
  R09: "This repair shop appears on several other claims this year.",
  R10: "The attached receipt does not fully support the estimate.",
};
const NEXT = {
  approve: "Approve. No rules fired and the claim is within the fast-track limit.",
  review: "Review the documents and the flagged items, then approve or ask the customer for more information.",
  escalate: "Escalate to the claim manager with a note on what looks unusual. Do not tell the customer why.",
  decline: "Reject with the reason, since a policy condition is not met.",
};
export function narrate(c) {
  const ev = c.evaluation;
  const fired = ev.results.filter((r) => r.status === "fail");
  const summary = fired.length
    ? `${fired.length} rule${fired.length === 1 ? "" : "s"} fired on this claim, giving a risk score of ${ev.score} out of 100 (${ev.band}). ${fired.map((r) => r.name).join(", ")}. These are indicators that warrant review, not a finding of fraud.`
    : `No rules fired. Risk score ${ev.score} out of 100 (${ev.band}). ${ev.fastTrack ? "The claim is eligible for fast-track approval." : "Standard review applies."}`;
  return {
    summary,
    flag_reasons: fired.map((r) => ({ rule_id: r.id, reasoning: `${WHY[r.id] || r.text || r.name + "."} ${r.detail}` })),
    recommendation: NEXT[ev.action] || NEXT.review,
  };
}

// ---------------- claims ----------------
const claims = new Map();
export const allClaims = () => [...claims.values()];
export const getClaim = (id) => claims.get(id);

function log(c, who, text) { c.history.push({ at: stamp(), who, text }); }
function tell(c, text) { c.customerLog.push({ at: stamp(), text }); }

function score(c) {
  c.evaluation = evaluate(c, currentRuleset());
  c.narrative = narrate(c);
  c.priority = priority(c.evaluation.score);
}

export function createCustomerClaim(body, savedFiles) {
  const n = body.normalized || {};
  const idNum = 1042 + allClaims().filter((c) => c.source === "customer").length;
  const id = "CLM-2026-" + idNum;
  const received = new Date().toISOString().slice(0, 10);
  const c = {
    id, source: "customer", claimant: n.claimant_name || "Unknown claimant", type: body.incident?.loss_type || "Motor, own damage",
    received, due: addDays(received, 14), status: "New", assignee: NEW_CLAIM_ASSIGNEE,
    amount: Number(n.estimate_total) || 0, normalized: n, fields: body.fields || [], documents: body.documents || [],
    incident: body.incident || null, docFiles: savedFiles, checklist: body.checklist || [], receipt: null,
    decision: null, escalation: null, history: [], customerLog: [],
  };
  score(c);
  log(c, "Customer", `Submitted the claim with ${savedFiles.length} documents`);
  log(c, "AI", `Documents read and checked. Risk score ${c.evaluation.score} (${c.evaluation.band}); suggested action: ${c.evaluation.outcome}`);
  tell(c, "Claim received. Reference " + id + ".");
  tell(c, `${savedFiles.length} documents uploaded, read and checked automatically.`);
  tell(c, "Assigned to a claims officer. Complete documents are decided within 10 working days.");
  claims.set(id, c);
  return c;
}

export function attachReceipt(c, receipt) {
  c.receipt = receipt;
  const before = c.evaluation.score;
  score(c);
  log(c, "Customer", `Attached receipt ${receipt.invoice_no || ""} from ${receipt.vendor_name} for PHP ${Math.round(receipt.total).toLocaleString("en-PH")}`);
  if (c.evaluation.score !== before) log(c, "AI", `Receipt checked. Risk score ${before} to ${c.evaluation.score}`);
  tell(c, `Receipt ${receipt.invoice_no || ""} from ${receipt.vendor_name} added.`);
}

// Executive or manager decision. Returns an error string or null.
export function decide(c, who, role, { action, note }) {
  const text = String(note || "").trim();
  const allowed = role === "manager" ? ["Escalated", ...OPEN] : OPEN;
  if (!allowed.includes(c.status)) return `This claim is ${c.status.toLowerCase()} and can no longer be changed here.`;
  const ev = c.evaluation;
  const warn = action === "approve" && ev.score >= 30 ? ` (above the recommended action; risk score ${ev.score})` : "";
  if (action === "approve") {
    c.status = "Approved"; c.decision = { action, by: who, role, note: text, at: stamp() };
    log(c, who, `Approved${warn}. ${text}`.trim());
    tell(c, "Your claim was approved. Payment is released within 3 working days.");
  } else if (action === "reject") {
    if (!text) return "A reason is required to reject a claim.";
    c.status = "Rejected"; c.decision = { action, by: who, role, note: text, at: stamp() };
    log(c, who, `Rejected. Reason: ${text}`);
    tell(c, "We could not approve your claim. A claims officer will contact you with the reason.");
  } else if (action === "escalate") {
    if (role !== "executive") return "Only a claim executive can escalate a case.";
    if (!text) return "Add a note for the manager explaining why you are escalating.";
    c.status = "Escalated"; c.escalation = { by: who, note: text, at: stamp() };
    log(c, who, `Escalated to the claim manager. Note: ${text}`);
  } else if (action === "request_docs") {
    if (!text) return "Say which documents or information you need.";
    c.status = "Documents requested";
    log(c, who, `Requested documents from the customer: ${text}`);
    tell(c, "We need more information: " + text);
  } else if (action === "return") {
    if (role !== "manager") return "Only the manager can return a case.";
    if (!text) return "Add a comment for the executive.";
    c.status = "In review"; c.escalation = null;
    log(c, who, `Returned to ${c.assignee} for follow-up. Comment: ${text}`);
  } else return "Unknown action.";
  return null;
}

// Publish a new rule set, then re-score every open claim that has documents behind it.
export function publishRules(rules, note, by) {
  const old = Object.fromEntries(ruleState.rules.map((r) => [r.id, r]));
  const changes = [];
  const seen = new Set();
  for (const r of rules) {
    seen.add(r.id);
    const o = old[r.id];
    if (!o) { changes.push(`${r.id} added: ${r.name}`); continue; }
    if (r.custom && JSON.stringify(o.cond) !== JSON.stringify(r.cond)) changes.push(`${r.id} condition changed`);
    if (o.enabled !== r.enabled) changes.push(`${r.id} ${r.enabled ? "switched on" : "switched off"}`);
    if (o.action !== r.action) changes.push(`${r.id} action ${o.action} to ${r.action}`);
    if (o.weight !== r.weight) changes.push(`${r.id} weight ${o.weight} to ${r.weight}`);
    if (!r.custom && (o.param?.value ?? null) !== (r.param?.value ?? null)) changes.push(`${r.id} ${r.param.label.toLowerCase()} ${o.param.value} to ${r.param.value}`);
  }
  for (const id of Object.keys(old)) if (!seen.has(id)) changes.push(`${id} deleted`);
  ruleState.rules = rules;
  ruleState.version += 1;
  ruleState.log.unshift({ version: ruleState.version, at: stamp(), by, note: note || "", changes });
  const rescored = [];
  for (const c of allClaims()) {
    if (!c.normalized || isFinal(c.status)) continue;
    const before = c.evaluation.score, beforeAction = c.evaluation.outcome;
    score(c);
    if (before !== c.evaluation.score || beforeAction !== c.evaluation.outcome) {
      rescored.push({ id: c.id, from: before, to: c.evaluation.score, outcome: c.evaluation.outcome });
      log(c, "AI", `Rules updated to version ${ruleState.version}. Risk score ${before} to ${c.evaluation.score}; suggested action: ${c.evaluation.outcome}`);
    }
  }
  return { version: ruleState.version, rescored };
}

// ---------------- views ----------------
const STAGE = { New: 2, "In review": 2, "Documents requested": 2, Escalated: 2, Approved: 3, Rejected: 3, Paid: 4 };
const CUSTOMER_LABEL = { New: "Under review", "In review": "Under review", "Documents requested": "Documents requested", Escalated: "Under review", Approved: "Approved", Rejected: "Declined", Paid: "Paid" };
export const customerSummary = (c) => ({ id: c.id, type: c.type, received: c.received, amount: c.amount, stage: STAGE[c.status], label: CUSTOMER_LABEL[c.status], status: c.status });
// What the customer may see: never the score, the rules or the escalation.
export const customerView = (c) => ({
  ...customerSummary(c), normalized: c.normalized, fields: c.fields, documents: c.documents, docFiles: c.docFiles,
  checklist: c.checklist, receipt: c.receipt, incident: c.incident,
  log: [...c.customerLog].reverse().map((l) => ({ t: new Date(l.at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }), text: l.text })),
});
export const listRow = (c) => ({
  id: c.id, claimant: c.claimant, type: c.type, amount: c.amount, received: c.received, due: c.due, status: c.status, assignee: c.assignee,
  priority: c.priority, score: c.evaluation.score, band: c.evaluation.band, outcome: c.evaluation.outcome, action: c.evaluation.action,
  escalation: c.escalation, decision: c.decision, source: c.source,
});

// ---------------- seed ----------------
const flag = (id, name, weight, action, detail) => ({ id, name, status: "fail", weight, action, detail });
function seedClaim(o) {
  const ev = { results: o.flags || [], checklist: [], score: o.score, band: band(o.score), action: o.action, outcome: ACTION_LABEL[o.action], fastTrack: o.action === "approve", firedIds: (o.flags || []).map((f) => f.id), policy: null };
  const c = {
    id: o.id, source: "seed", claimant: o.claimant, type: o.type, received: o.received, due: addDays(o.received, 14), status: o.status, assignee: o.assignee,
    amount: o.amount, normalized: null, fields: [], documents: [], incident: null, docFiles: [], checklist: [], receipt: null,
    decision: o.decision || null, escalation: o.escalation || null, history: o.history, customerLog: [], evaluation: ev, priority: priority(o.score),
  };
  c.narrative = narrate(c);
  claims.set(c.id, c);
}
export function resetClaims() {
  claims.clear();
  const h = (who, text, d) => ({ at: d + "T09:00:00.000Z", who, text });
  seedClaim({ id: "CLM-2026-1031", claimant: "Dennis C. Uy", type: "Motor, own damage", amount: 71300, received: "2026-10-19", status: "In review", assignee: "Maricar Ocampo", score: 18, action: "review", flags: [flag("R06", "Estimate vs. typical repair cost", 10, "review", "Estimate PHP 71,300 vs typical PHP 61,000 (+17%, limit 25%)")], history: [h("AI", "Documents read. Risk score 18 (Low)", "2026-10-19"), h("Maricar Ocampo", "Picked up the claim", "2026-10-20")] });
  seedClaim({ id: "CLM-2026-1029", claimant: "Rosalie B. Navarro", type: "Fire, residential", amount: 420000, received: "2026-10-18", status: "Documents requested", assignee: "Jun Sarmiento", score: 31, action: "review", flags: [flag("R03", "Required documents complete", 0, "review", "Missing: Fire report from the Bureau of Fire Protection"), flag("R02", "Prompt notice of loss", 8, "review", "Reported 9 days after the loss (limit 7)")], history: [h("AI", "Documents read. Risk score 31 (Medium)", "2026-10-18"), h("Jun Sarmiento", "Requested documents from the customer: BFP fire report and proof of ownership", "2026-10-19")] });
  seedClaim({ id: "CLM-2026-1024", claimant: "Angelica F. Reyes", type: "Motor, own damage", amount: 35400, received: "2026-10-16", status: "Approved", assignee: "Maricar Ocampo", score: 9, action: "approve", decision: { action: "approve", by: "Maricar Ocampo", role: "executive", note: "Fast-track, complete documents.", at: "2026-10-16T11:00:00.000Z" }, history: [h("AI", "Documents read. Risk score 9 (Low); eligible for fast-track", "2026-10-16"), h("Maricar Ocampo", "Approved. Fast-track, complete documents.", "2026-10-16")] });
  seedClaim({ id: "CLM-2026-1019", claimant: "Felix T. Mercado", type: "Personal accident", amount: 58000, received: "2026-10-15", status: "In review", assignee: "Maricar Ocampo", score: 22, action: "review", flags: [flag("R10", "Receipt validity and match", 12, "review", "Hospital receipt total differs from the claimed amount by 14% (tolerance 10%)")], history: [h("AI", "Documents read. Risk score 22 (Low)", "2026-10-15")] });
  seedClaim({ id: "CLM-2026-1017", claimant: "Teresita G. Cruz", type: "Motor, third party", amount: 96500, received: "2026-10-14", status: "Escalated", assignee: "Jun Sarmiento", score: 68, action: "escalate", flags: [flag("R09", "Repair shop concentration", 14, "review", "The repair shop appears on 4 claims in the last 12 months (threshold 3)"), flag("R08", "Duplicate / repeat claim", 28, "escalate", "Similar damage on the same plate 52 days ago (CLM-2026-0944)"), flag("R06", "Estimate vs. typical repair cost", 10, "review", "Estimate +38% above typical (limit 25%)"), flag("R02", "Prompt notice of loss", 8, "review", "Reported 21 days after the loss"), flag("R10", "Receipt validity and match", 12, "review", "No TIN on the receipt")], escalation: { by: "Jun Sarmiento", note: "Third-party injury claim and the same shop is on four other claims. The earlier claim on this plate was never repaired. I would like your view before I contact the claimant.", at: "2026-10-21T14:20:00.000Z" }, history: [h("AI", "Documents read. Risk score 68 (High); suggested action: Escalate", "2026-10-14"), h("Jun Sarmiento", "Escalated to the claim manager. Note: Third-party injury claim and the same shop is on four other claims.", "2026-10-21")] });
  seedClaim({ id: "CLM-2026-1011", claimant: "Bernard K. Co", type: "Motor, theft", amount: 610000, received: "2026-10-12", status: "Escalated", assignee: "Maricar Ocampo", score: 47, action: "review", flags: [flag("R07", "Early claim after inception", 22, "escalate", "Loss occurred 19 days after policy inception (window 30 days)"), flag("R06", "Estimate vs. typical repair cost", 10, "review", "Declared value +30% above market guide"), flag("R02", "Prompt notice of loss", 8, "review", "Reported 11 days after the loss"), flag("R03", "Required documents complete", 0, "review", "Police report is a blotter only, no certified copy")], escalation: { by: "Maricar Ocampo", note: "High-value theft, policy only 19 days old. Documents are incomplete and the claimant is pressing for a quick payout. Need a decision on how far to investigate.", at: "2026-10-22T10:05:00.000Z" }, history: [h("AI", "Documents read. Risk score 47 (Medium)", "2026-10-12"), h("Maricar Ocampo", "Escalated to the claim manager. Note: High-value theft, policy only 19 days old.", "2026-10-22")] });
  seedClaim({ id: "CLM-2026-1006", claimant: "Maribel S. Ramos", type: "Motor, own damage", amount: 28900, received: "2026-10-10", status: "Paid", assignee: "Maricar Ocampo", score: 6, action: "approve", decision: { action: "approve", by: "Maricar Ocampo", role: "executive", note: "Complete documents.", at: "2026-10-11T09:30:00.000Z" }, history: [h("AI", "Documents read. Risk score 6 (Low); eligible for fast-track", "2026-10-10"), h("Maricar Ocampo", "Approved. Complete documents.", "2026-10-11"), h("System", "Payment released by bank transfer", "2026-10-13")] });
  seedClaim({ id: "CLM-2026-1003", claimant: "Rodel P. Santos", type: "Motor, own damage", amount: 52000, received: "2026-10-08", status: "Rejected", assignee: "Jun Sarmiento", score: 55, action: "decline", flags: [flag("R04", "Authorised driver with valid license", 0, "decline", "The driver is not an authorised driver on the policy")], decision: { action: "reject", by: "Jun Sarmiento", role: "executive", note: "The driver at the time of loss is not named on the policy.", at: "2026-10-09T15:10:00.000Z" }, history: [h("AI", "Documents read. Risk score 55 (Medium); suggested action: Decline", "2026-10-08"), h("Jun Sarmiento", "Rejected. Reason: The driver at the time of loss is not named on the policy.", "2026-10-09")] });
}
resetRules();
resetClaims();
