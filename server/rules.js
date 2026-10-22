// Deterministic approval-rule engine. The same function drives the score, the flags and
// the recommended action, so the rules editor and the fraud score are one mechanism.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const load = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));
export const policies = load("policies.json");
export const history = load("claims_history.json");
export const typicalCosts = load("typical_costs.json");
export const defaultRules = load("rules_default.json");

const DAY = 86400000;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);
const php = (n) => "PHP " + Math.round(n).toLocaleString("en-PH");
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ACTION_RANK = { approve: 0, review: 1, escalate: 2, decline: 3 };
export const ACTION_LABEL = {
  approve: "Fast-track approval",
  review: "Adjuster review",
  escalate: "Escalate to SIU",
  decline: "Decline (policy condition not met)",
};
const REQUIRED_DOCS = [
  ["claim_form", "Claim form"],
  ["or_cr", "LTO OR/CR"],
  ["drivers_license", "Driver's license"],
  ["police_report", "Police report"],
  ["repair_estimate", "Repair estimate"],
];

export function evaluate(claim, ruleset) {
  const n = claim.normalized;
  const rules = ruleset.rules;
  const policy = policies.find((p) => norm(p.policy_no) === norm(n.policy_no));
  const presentDocs = new Set((claim.documents || []).map((d) => d.doc_type));
  const checklist = REQUIRED_DOCS.map(([type, label]) => ({
    type, label,
    present: presentDocs.has(type),
    needed: type !== "police_report" || ["front_collision", "rear_collision", "side_collision", "theft"].includes(n.damage_category),
  }));
  const estimate = Number(n.estimate_total) || 0;
  const results = [];

  for (const r of rules) {
    const p = r.param?.value;
    const out = { id: r.id, name: r.name, text: r.text, action: r.action, weight: r.weight, param: r.param, kind: r.kind, status: "pass", detail: "" };
    if (!r.enabled) { out.status = "off"; out.detail = "Rule switched off"; results.push(out); continue; }

    switch (r.id) {
      case "R01": {
        if (!policy) { out.status = "fail"; out.detail = `Policy ${n.policy_no || "(not found)"} not found on the policy register`; break; }
        const inForce = n.loss_date >= policy.inception && n.loss_date <= policy.expiry;
        if (!inForce || !policy.premium_paid) {
          out.status = "fail";
          out.detail = !inForce ? `Loss date ${n.loss_date} outside ${policy.inception} to ${policy.expiry}` : "Premium unpaid";
        } else out.detail = `In force ${policy.inception} to ${policy.expiry}, premium paid`;
        break;
      }
      case "R02": {
        const d = days(n.loss_date, n.reported_date);
        if (Number.isNaN(d)) { out.status = "na"; out.detail = "Dates not readable"; break; }
        out.detail = `Reported ${d} day(s) after the loss (limit ${p})`;
        if (d > p) out.status = "fail";
        break;
      }
      case "R03": {
        const missing = checklist.filter((c) => c.needed && !c.present).map((c) => c.label);
        if (missing.length) { out.status = "fail"; out.detail = "Missing: " + missing.join(", "); }
        else out.detail = "All required documents present";
        break;
      }
      case "R04": {
        if (!policy) { out.status = "na"; out.detail = "No policy record"; break; }
        const authorised = policy.authorized_drivers.some((a) => norm(a) === norm(n.driver_name));
        const licenceOk = n.license_expiry && n.license_expiry >= n.loss_date;
        if (!authorised || !licenceOk) {
          out.status = "fail";
          out.detail = !authorised ? `${n.driver_name || "Driver"} is not an authorised driver` : `License expired ${n.license_expiry}`;
        } else out.detail = `${n.driver_name} is authorised, license valid to ${n.license_expiry}`;
        break;
      }
      case "R05": {
        out.status = "na"; // evaluated after the flags are known
        break;
      }
      case "R06": {
        const typical = typicalCosts[`${n.vehicle_model}|${n.damage_category}`];
        if (!typical) { out.status = "na"; out.detail = "No benchmark for this vehicle and damage type"; break; }
        const dev = Math.round(((estimate - typical) / typical) * 100);
        out.detail = `Estimate ${php(estimate)} vs typical ${php(typical)} (${dev >= 0 ? "+" : ""}${dev}%, limit ${p}%)`;
        if (dev > p) out.status = "fail";
        break;
      }
      case "R07": {
        if (!policy) { out.status = "na"; out.detail = "No policy record"; break; }
        const d = days(policy.inception, n.loss_date);
        out.detail = `Loss occurred ${d} day(s) after policy inception (${policy.inception}); window ${p} days`;
        if (d >= 0 && d < p) out.status = "fail";
        break;
      }
      case "R08": {
        const hits = history.filter((h) => norm(h.plate_no) === norm(n.plate_no) && Math.abs(days(h.loss_date, n.loss_date)) <= p);
        if (hits.length) {
          out.status = "fail";
          out.matches = hits;
          out.detail = hits.map((h) => `${h.id} (${h.loss_date}, ${h.damage_areas.join(", ")}, ${php(h.amount)}, ${h.status})`).join("; ");
        } else out.detail = `No other claim on this plate within ${p} days`;
        break;
      }
      case "R09": {
        const shop = norm(n.repair_shop);
        const all = history.filter((h) => norm(h.shop) === shop && days(h.loss_date, n.loss_date) <= 365 && days(h.loss_date, n.loss_date) >= 0);
        out.detail = `${n.repair_shop || "Shop"} appears on ${all.length} claim(s) in the last 12 months (threshold ${p})`;
        out.shopClaims = all.map((h) => h.id);
        if (all.length >= p) out.status = "fail";
        break;
      }
      case "R10": {
        const rc = claim.receipt;
        if (!rc) { out.status = "na"; out.detail = "No receipt attached"; break; }
        const problems = [];
        if (!rc.vendor_tin) problems.push("no TIN");
        if (!rc.invoice_no) problems.push("no invoice/OR number");
        if (!rc.date) problems.push("no date");
        if (!(rc.total > 0)) problems.push("no total");
        if (estimate > 0 && rc.total > 0) {
          const dev = Math.round((Math.abs(rc.total - estimate) / estimate) * 100);
          if (dev > p) problems.push(`total ${php(rc.total)} differs from estimate ${php(estimate)} by ${dev}% (tolerance ${p}%)`);
        }
        if (problems.length) { out.status = "fail"; out.detail = problems.join("; "); }
        else out.detail = `Receipt ${rc.invoice_no} from ${rc.vendor_name}, ${php(rc.total)}, matches estimate`;
        break;
      }
      default:
        out.status = "na";
    }
    results.push(out);
  }

  const failed = results.filter((r) => r.status === "fail");
  const score = Math.min(100, failed.reduce((s, r) => s + (r.weight || 0), 0));
  const band = score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";

  // R05 fast-track eligibility
  const r05 = results.find((r) => r.id === "R05");
  const r05rule = rules.find((r) => r.id === "R05");
  let fastTrack = false;
  if (r05 && r05rule?.enabled) {
    const limit = r05rule.param.value;
    const eligible = failed.length === 0 && estimate > 0 && estimate <= limit;
    fastTrack = eligible;
    r05.status = eligible ? "pass" : "na";
    r05.detail = eligible
      ? `Estimate ${php(estimate)} is within the ${php(limit)} limit with no flags: eligible`
      : failed.length ? "Not eligible: other rules fired" : `Estimate ${php(estimate)} exceeds the ${php(limit)} limit`;
  }

  let action = "review";
  if (failed.length) action = failed.reduce((a, r) => (ACTION_RANK[r.action] > ACTION_RANK[a] ? r.action : a), "review");
  else if (fastTrack) action = "approve";

  return {
    results, checklist, score, band, action,
    outcome: ACTION_LABEL[action],
    fastTrack,
    firedIds: failed.map((r) => r.id),
    policy: policy || null,
  };
}
