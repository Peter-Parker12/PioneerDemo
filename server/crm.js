// In-memory CRM for the agent demo. Both the UI and the assistant's tools go through these functions,
// so whatever the assistant does is what the agent sees in the lead list.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
export const STAGES = ["New", "Contacted", "Quoted", "Negotiation", "Won", "Lost"];
export const PRIORITIES = ["High", "Medium", "Low"];
export const TODAY = "2026-10-23"; // fixed so the seeded follow-up dates always make sense in the demo

let leads = [];
let emails = [];
export function resetCrm() {
  leads = JSON.parse(fs.readFileSync(path.join(dataDir, "leads.json"), "utf8"));
  emails = [];
}
resetCrm();

export const listLeads = () => leads;
export const sentEmails = () => emails;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

export function findLead(ref) {
  if (!ref) return null;
  const n = norm(ref);
  return leads.find((l) => norm(l.id) === n) || leads.find((l) => norm(l.name) === n)
    || leads.find((l) => norm(l.name).includes(n)) || leads.find((l) => n.split(" ").some((w) => w.length > 2 && norm(l.name).split(" ").includes(w)));
}

function log(lead, type, text) {
  lead.activities.unshift({ date: TODAY, type, text });
}

const clip = (l) => ({ id: l.id, name: l.name, stage: l.stage, product: l.product, priority: l.priority, premium: l.premium, last_contact: l.last_contact, next_step: l.next_step, next_due: l.next_due });

// ----- operations (return a result object; `change` is shown to the agent as an action card) -----
export function searchLeads({ query, stage, product } = {}) {
  const q = norm(query);
  const out = leads.filter((l) =>
    (!stage || l.stage.toLowerCase() === stage.toLowerCase()) &&
    (!product || norm(l.product).includes(norm(product))) &&
    (!q || norm(`${l.name} ${l.product} ${l.location} ${l.notes}`).includes(q)));
  return { result: { count: out.length, leads: out.map(clip) } };
}

export function getLead({ lead }) {
  const l = findLead(lead);
  if (!l) return { error: `No lead matches "${lead}"` };
  return { result: { ...l, activities: l.activities.slice(0, 6) } };
}

export function updateLead({ lead, stage, priority, next_step, next_due, notes }) {
  const l = findLead(lead);
  if (!l) return { error: `No lead matches "${lead}"` };
  const changes = [];
  if (stage) {
    const s = STAGES.find((x) => x.toLowerCase() === String(stage).toLowerCase());
    if (!s) return { error: `Stage must be one of: ${STAGES.join(", ")}` };
    if (s !== l.stage) { changes.push(`stage ${l.stage} → ${s}`); l.stage = s; }
  }
  if (priority) {
    const p = PRIORITIES.find((x) => x.toLowerCase() === String(priority).toLowerCase());
    if (!p) return { error: `Priority must be one of: ${PRIORITIES.join(", ")}` };
    if (p !== l.priority) { changes.push(`priority ${l.priority} → ${p}`); l.priority = p; }
  }
  if (next_step && next_step !== l.next_step) { changes.push(`next step "${next_step}"`); l.next_step = next_step; }
  if (next_due && next_due !== l.next_due) { changes.push(`follow-up ${next_due}`); l.next_due = next_due; }
  if (notes) { changes.push("note added"); log(l, "note", notes); }
  if (!changes.length) return { result: { lead: l.id, unchanged: true } };
  log(l, "update", "Updated: " + changes.join(", "));
  return { result: { lead: l.id, name: l.name, changes }, action: { kind: "update", lead_id: l.id, title: `Updated ${l.name}`, detail: changes.join(" · ") } };
}

export function addNote({ lead, note }) {
  const l = findLead(lead);
  if (!l) return { error: `No lead matches "${lead}"` };
  log(l, "note", note);
  return { result: { lead: l.id, name: l.name }, action: { kind: "note", lead_id: l.id, title: `Note added to ${l.name}`, detail: note } };
}

export function createLead({ name, phone = "", email = "", product = "Personal Accident", source = "Agent entry", notes = "" }) {
  const existing = leads.find((l) => norm(l.name) === norm(name));
  if (existing) return { result: { lead: existing.id, name, existing: true } };
  const id = "L-" + (100 + leads.length + 1);
  const l = { id, name, phone, email, location: "", source, product, stage: "New", priority: "Medium", premium: 0, last_contact: "", next_step: "Intro call", next_due: TODAY, notes, activities: [] };
  log(l, "note", "Lead created by the assistant");
  leads.unshift(l);
  return { result: { lead: id, name }, action: { kind: "create", lead_id: id, title: `Created lead ${name}`, detail: `${product} · stage New` } };
}

export function sendEmail({ lead, subject, body }) {
  const l = findLead(lead);
  if (!l) return { error: `No lead matches "${lead}"` };
  if (!l.email) return { error: `${l.name} has no email address on file` };
  const mail = { id: "M-" + (emails.length + 1), lead_id: l.id, to: l.email, to_name: l.name, subject, body, at: TODAY };
  emails.push(mail);
  l.last_contact = TODAY;
  log(l, "email", `Email sent: "${subject}"`);
  return { result: { sent: true, to: l.email }, action: { kind: "email", lead_id: l.id, title: `Email sent to ${l.name}`, detail: subject, email: mail } };
}

// ----- tool schema for the model -----
const leadRef = { type: "string", description: "Lead id (e.g. L-101) or the lead's name" };
export const tools = [
  { name: "search_leads", description: "List leads, optionally filtered by free text, stage or product. Use it to answer questions about the pipeline or to find who needs follow-up (next_due on or before today).",
    input_schema: { type: "object", properties: { query: { type: "string" }, stage: { type: "string", enum: STAGES }, product: { type: "string" } } } },
  { name: "get_lead", description: "Get the full record and recent activity of one lead.",
    input_schema: { type: "object", properties: { lead: leadRef }, required: ["lead"] } },
  { name: "update_lead", description: "Update a lead's stage, priority, next step, follow-up date (YYYY-MM-DD) or add a note.",
    input_schema: { type: "object", properties: { lead: leadRef, stage: { type: "string", enum: STAGES }, priority: { type: "string", enum: PRIORITIES }, next_step: { type: "string" }, next_due: { type: "string", description: "YYYY-MM-DD" }, notes: { type: "string" } }, required: ["lead"] } },
  { name: "add_note", description: "Add a note to a lead's activity log.",
    input_schema: { type: "object", properties: { lead: leadRef, note: { type: "string" } }, required: ["lead", "note"] } },
  { name: "create_lead", description: "Create a new lead.",
    input_schema: { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, product: { type: "string", enum: ["Personal Accident", "Motor Comprehensive", "Home Fire"] }, source: { type: "string" }, notes: { type: "string" } }, required: ["name"] } },
  { name: "send_email", description: "Send an email to a lead on the agent's behalf. Write a complete, professional email signed 'Angelo Reyes, Workforce Solution'. Only include product facts that come from the product sheets.",
    input_schema: { type: "object", properties: { lead: leadRef, subject: { type: "string" }, body: { type: "string" } }, required: ["lead", "subject", "body"] } },
];

export const run = {
  search_leads: searchLeads, get_lead: getLead, update_lead: updateLead,
  add_note: addNote, create_lead: createLead, send_email: sendEmail,
};
