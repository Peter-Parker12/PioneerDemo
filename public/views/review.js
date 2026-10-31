// Claim review screen shared by the claim executive and the claim manager.
import { openViewer } from "/views/viewer.js";
import { $, esc, php, fmtDate, api, toast, modal } from "/app.js";

export const statusChip = (s) => {
  const c = /approved|paid/i.test(s) ? "green" : /rejected/i.test(s) ? "red" : /escalated/i.test(s) ? "amber" : /request/i.test(s) ? "amber" : /new/i.test(s) ? "blue" : "";
  return `<span class="chip ${c}">${esc(s)}</span>`;
};
export const scoreClass = (s) => (s >= 60 ? "high" : s >= 30 ? "med" : "low");
const gauge = (s) => {
  const c = 2 * Math.PI * 52, col = s >= 60 ? "#d3433b" : s >= 30 ? "#e0a21a" : "#1f9d63";
  return `<svg class="gauge" viewBox="0 0 130 130" role="img" aria-label="Risk score ${s} of 100"><circle cx="65" cy="65" r="52" fill="none" stroke="#e7ebf2" stroke-width="12"/>
    <circle cx="65" cy="65" r="52" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * s) / 100} ${c}" transform="rotate(-90 65 65)"/>
    <text x="65" y="64" text-anchor="middle" font-size="32" font-weight="800" fill="${col}">${s}</text><text x="65" y="84" text-anchor="middle" font-size="11" fill="#66738a">of 100</text></svg>`;
};
const DOC_LABEL = { claim_form: "Claim form", or_cr: "OR/CR", drivers_license: "Driver's license", police_report: "Police report", repair_estimate: "Repair estimate" };
const docLabel = (c, d) => d.slot || DOC_LABEL[c.documents?.find((x) => x.filename === d.name)?.doc_type] || d.name;
const sizeOf = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const when = (iso) => new Date(iso).toLocaleString("en-PH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const ACTIONS = {
  executive: [["approve", "Approve", "ok"], ["reject", "Reject", "danger"], ["escalate", "Escalate to manager", "amber"], ["request_docs", "Request documents", ""]],
  manager: [["approve", "Approve", "ok"], ["reject", "Reject", "danger"], ["return", "Return to executive", "amber"], ["request_docs", "Request documents", ""]],
};
const SUGGESTED = { approve: "approve", decline: "reject", escalate: "escalate" }; // AI action -> button

export async function renderReview(root, id, role, view = {}) {
  let c = view.claim;
  const back = role === "manager" ? "#/manager" : "#/executive";
  if (!c) {
    try { c = await api("/claims/" + id); }
    catch (e) { root.innerHTML = `<div class="card empty">${esc(e.message)} <a href="${back}">Back to the queue</a></div>`; return; }
  }
  const ev = c.evaluation, n = c.normalized, inc = c.incident;
  const fired = ev.results.filter((r) => r.status === "fail");
  const reasons = Object.fromEntries((c.narrative?.flag_reasons || []).map((r) => [r.rule_id, r.reasoning]));
  const docIdx = view.doc ?? 0, doc = c.docFiles[docIdx];
  const recClass = ev.action === "approve" ? "green" : ev.action === "review" ? "amber" : "red";
  const dup = ev.results.find((r) => r.id === "R08" && r.matches);
  const actionable = role === "manager" ? ["Escalated", "New", "In review", "Documents requested"].includes(c.status) : ["New", "In review", "Documents requested"].includes(c.status);
  const suggested = SUGGESTED[ev.action];

  root.innerHTML = `
    <div class="page-head">
      <div><a href="${back}" class="small">← ${role === "manager" ? "Case oversight" : "Claims queue"}</a><h1>${c.id}, ${esc(c.claimant)}</h1>
        <div class="muted">${esc(c.type)}${n ? ` · ${esc(n.vehicle_model)} ${esc(n.plate_no)} · loss ${fmtDate(n.loss_date)}` : ""} · ${php(c.amount)}</div></div>
      <div style="display:flex;gap:8px;align-items:center">${statusChip(c.status)}<span class="chip">Assigned to ${esc(c.assignee)}</span></div>
    </div>
    ${c.escalation && c.status === "Escalated" ? `<div class="callout"><b>Escalated by ${esc(c.escalation.by)}</b> <span class="muted small">${when(c.escalation.at)}</span><div>${esc(c.escalation.note)}</div></div>` : ""}
    ${c.decision ? `<div class="callout ok"><b>${c.decision.action === "approve" ? "Approved" : "Rejected"} by ${esc(c.decision.by)}</b> <span class="muted small">${when(c.decision.at)}</span>${c.decision.note ? `<div>${esc(c.decision.note)}</div>` : ""}</div>` : ""}
    <div class="${c.docFiles.length ? "split" : ""}">
      ${c.docFiles.length ? `<div class="viewer card">
        <div class="tabs">${c.docFiles.map((d, i) => `<button class="tab ${i === docIdx ? "on" : ""}" data-doc="${i}">${esc(docLabel(c, d))}</button>`).join("")}</div>
        ${doc?.url ? `<div class="preview"><iframe src="${doc.url}#toolbar=0&navpanes=0" title="${esc(doc.name)}" tabindex="-1"></iframe><button class="preview-open" data-viewer aria-label="Open ${esc(docLabel(c, doc))} in a larger viewer"><span class="chip">Click to enlarge</span></button></div>` : ""}
        <div class="quote" ${view.quote ? "" : "hidden"}>${view.quote ? `Read from <b>${esc(view.quoteDoc)}</b>: “${esc(view.quote)}”` : ""}</div>
      </div>` : ""}
      <div>
        <div class="card">
          <div class="gauge-wrap">
            ${gauge(ev.score)}
            <div style="flex:1">
              <div class="muted small">AI suggested action</div>
              <div style="margin:2px 0 4px"><span class="chip ${recClass}" style="font-size:15px;padding:4px 12px">${esc(ev.outcome)}</span></div>
              <div class="muted small" style="margin-bottom:8px">Risk band <b>${ev.band}</b> · ${fired.length} rule${fired.length === 1 ? "" : "s"} fired</div>
              <div>${esc(c.narrative.summary)}</div>
            </div>
          </div>
          <div class="small" style="margin-top:10px"><b>Suggested next step:</b> <span class="muted">${esc(c.narrative.recommendation)}</span></div>
        </div>

        <div class="card">
          <h2>Attached documents <span class="muted small">${c.docFiles.length} file${c.docFiles.length === 1 ? "" : "s"}</span></h2>
          ${c.docFiles.length ? c.docFiles.map((d, i) => {
            const sum = c.documents?.find((x) => x.filename === d.name)?.summary;
            return `<div class="docrow"><div style="min-width:0"><b>${esc(docLabel(c, d))}</b><div class="small muted">${esc(d.name)}${d.size ? ", " + sizeOf(d.size) : ""}</div>${sum ? `<div class="small">${esc(sum)}</div>` : ""}</div>
              <button class="btn sm" data-view="${i}" aria-label="View ${esc(docLabel(c, d))}">View</button></div>`;
          }).join("") : `<div class="muted">No documents are on file for this claim in the demo.</div>`}
        </div>

        <div class="card">
          <h2>Why this score</h2>
          ${fired.length ? fired.map((r) => `<div class="flag ${r.weight >= 20 || ["escalate", "decline"].includes(r.action) ? "red" : "amber"}">
            <div class="rid">${r.id}</div><div style="flex:1"><b>${esc(r.name)}</b> <span class="muted small">+${r.weight} pts</span>
            <div class="small muted">${esc(r.detail)}</div>
            ${reasons[r.id] ? `<div style="margin-top:4px">${esc(reasons[r.id])}</div>` : ""}</div></div>`).join("") : `<div class="muted">No rules fired.${ev.fastTrack ? " This claim is eligible for fast-track approval." : ""}</div>`}
          ${ev.results.length > fired.length ? `<details style="margin-top:12px"><summary class="small muted" style="cursor:pointer">Rules that passed or did not apply (${ev.results.length - fired.length})</summary>
            ${ev.results.filter((r) => r.status !== "fail").map((r) => `<div class="check"><span class="dot ${r.status === "pass" ? "ok" : "na"}">${r.status === "pass" ? "✓" : "–"}</span><span><b>${r.id}</b> ${esc(r.name)} <span class="muted small">${esc(r.detail)}</span></span></div>`).join("")}</details>` : ""}
        </div>

        ${dup ? `<div class="card"><h2>Similar claims found</h2>
          <table><thead><tr><th>Claim</th><th>Loss date</th><th>Damage</th><th>Shop</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          <tr><td><b>${c.id}</b> (this)</td><td>${fmtDate(n.loss_date)}</td><td>${esc((n.damage_areas || []).join(", "))}</td><td>${esc(n.repair_shop)}</td><td>${php(n.estimate_total)}</td><td>${esc(c.status)}</td></tr>
          ${dup.matches.map((h) => `<tr><td><b>${h.id}</b></td><td>${fmtDate(h.loss_date)}</td><td>${esc(h.damage_areas.join(", "))}</td><td>${esc(h.shop)}</td><td>${php(h.amount)}</td><td>${esc(h.status)}</td></tr>`).join("")}
          </tbody></table>${dup.matches[0].note ? `<div class="small muted" style="margin-top:6px">Note on ${dup.matches[0].id}: ${esc(dup.matches[0].note)}</div>` : ""}</div>` : ""}

        ${inc ? `<div class="card"><h2>Reported by the customer</h2>
          <table class="fields"><tbody>
            <tr><td>Type of loss</td><td><b>${esc(inc.loss_type)}</b></td></tr>
            <tr><td>Date and time</td><td><b>${fmtDate(inc.loss_date)}${inc.loss_time ? ", " + esc(inc.loss_time) : ""}</b></td></tr>
            <tr><td>Place</td><td><b>${esc(inc.loss_place)}</b></td></tr>
            <tr><td>Injuries</td><td><b>${esc(inc.injuries)}</b></td></tr>
            <tr><td>Police report</td><td><b>${esc(inc.police)}${inc.police_no ? ", no. " + esc(inc.police_no) : ""}</b></td></tr>
            <tr><td>Contact</td><td><b>${esc(inc.phone)}, ${esc(inc.email)}</b></td></tr>
          </tbody></table><p style="margin:10px 0 0">${esc(inc.description)}</p></div>` : ""}

        ${c.fields.length ? `<div class="card"><h2>Extracted data <span class="muted small">click a row to see where it was read</span></h2>
          <table class="fields"><tbody>${c.fields.map((f, i) => `<tr class="click" data-field="${i}"><td>${esc(f.label)}</td><td><b>${esc(f.value)}</b></td><td style="width:90px;white-space:nowrap"><span class="conf"><i style="width:${Math.round(f.confidence * 100)}%;background:${f.confidence < 0.8 ? "#e0a21a" : "#1f9d63"}"></i></span><span class="small muted">${Math.round(f.confidence * 100)}%</span></td></tr>`).join("")}</tbody></table></div>` : ""}

        ${c.normalized ? `<div class="grid2" style="margin-top:16px">
          <div class="card"><h2>Document checklist</h2>${ev.checklist.map((k) => `<div class="check"><span class="dot ${k.present ? "ok" : k.needed ? "no" : "na"}">${k.present ? "✓" : k.needed ? "✕" : "–"}</span>${esc(k.label)}</div>`).join("")}</div>
          <div class="card"><h2>Receipt</h2>${c.receipt ? `<b>${esc(c.receipt.vendor_name)}</b><div class="small muted">${esc(c.receipt.document_type || "Receipt")} ${esc(c.receipt.invoice_no)} · ${fmtDate(c.receipt.date)}</div>
            <div style="font-size:20px;font-weight:700;margin:4px 0">${php(c.receipt.total)}</div>
            ${ev.results.find((r) => r.id === "R10")?.status === "fail" ? '<span class="chip red">Receipt check failed</span>' : '<span class="chip green">Matches estimate</span>'}
            <div class="small muted" style="margin-top:4px">${esc(ev.results.find((r) => r.id === "R10")?.detail || "")}</div>` : '<div class="muted">The customer has not attached a receipt yet.</div>'}</div></div>` : ""}

        <div class="card"><h2>Audit trail</h2><ul class="audit">${[...c.history].reverse().map((a) => `<li><span class="muted small">${when(a.at)}</span> <b>${esc(a.who)}</b> ${esc(a.text)}</li>`).join("")}</ul></div>

        <div class="actionbar">
          ${actionable ? `<span class="muted small">AI recommends, ${role === "manager" ? "the manager" : "the executive"} decides.</span><span class="right"></span>
            ${ACTIONS[role].map(([k, l, cls]) => `<button class="btn ${cls} ${k === suggested ? "suggested" : ""}" data-act="${k}" ${k === suggested ? 'title="Matches the AI suggestion"' : ""}>${l}</button>`).join("")}`
            : `<span>This claim is <b>${esc(c.status)}</b>${c.decision ? `, decided by ${esc(c.decision.by)}` : ""}. No further action here.</span>`}
        </div>
      </div>
    </div>`;

  const viewerDocs = () => c.docFiles.map((d) => ({ name: d.name, url: d.url, label: docLabel(c, d) }));
  root.querySelector("[data-viewer]")?.addEventListener("click", () => openViewer(viewerDocs(), docIdx));
  root.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => openViewer(viewerDocs(), +b.dataset.view)));
  root.querySelectorAll("[data-doc]").forEach((b) => (b.onclick = () => renderReview(root, id, role, { claim: c, doc: +b.dataset.doc })));
  root.querySelectorAll("[data-field]").forEach((tr) => (tr.onclick = () => {
    const f = c.fields[+tr.dataset.field];
    renderReview(root, id, role, { claim: c, doc: Math.max(0, c.docFiles.findIndex((d) => d.name === f.source_doc)), quote: f.source_quote, quoteDoc: f.source_doc });
  }));
  root.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => decide(root, c, role, b.dataset.act)));
}

function decide(root, c, role, action) {
  const ev = c.evaluation;
  const missing = (ev.checklist || []).filter((k) => k.needed && !k.present).map((k) => k.label);
  const fired = ev.results.filter((r) => r.status === "fail");
  const cfg = {
    approve: { title: "Approve claim", help: "Add a note for the audit trail (optional).", need: false, prefill: "Approved after review of the documents and the AI assessment.", btn: "Approve" },
    reject: { title: "Reject claim", help: "A reason is required. It is recorded in the audit trail.", need: true, prefill: fired.length ? "Rejected. " + fired.map((r) => `${r.id}: ${r.detail}`).join(" | ") : "", btn: "Reject claim" },
    escalate: { title: "Escalate to the manager", help: "Tell the manager what looks unusual. The customer is not told.", need: true, prefill: fired.length ? "Escalating for review. " + fired.map((r) => `${r.id}: ${r.detail}`).join(" | ") : "", btn: "Escalate" },
    return: { title: "Return to the executive", help: "Say what the executive should do next.", need: true, prefill: "", btn: "Return case" },
    request_docs: { title: "Request documents", help: "This message is shown to the customer.", need: true, prefill: `Please send: ${missing.length ? missing.join(", ") : "a clearer copy of your repair estimate and proof of payment"}.`, btn: "Send request" },
  }[action];
  const m = modal(`
    <h2>${cfg.title}</h2><p class="muted">${cfg.help}</p>
    <textarea id="note" rows="6">${esc(cfg.prefill)}</textarea>
    ${action === "approve" && ev.score >= 30 ? `<p class="chip amber" style="margin-top:10px;white-space:normal">Heads up: the risk score is ${ev.score}. Approving goes against the AI suggestion and is logged.</p>` : ""}
    <div id="err" class="small" style="color:var(--red);min-height:18px;margin-top:6px"></div>
    <div class="between" style="margin-top:8px"><button class="btn" id="cancel">Cancel</button><button class="btn primary" id="confirm">${cfg.btn}</button></div>`);
  m.el.querySelector("#cancel").onclick = m.close;
  m.el.querySelector("#confirm").onclick = async () => {
    const note = m.el.querySelector("#note").value;
    if (cfg.need && !note.trim()) { m.el.querySelector("#err").textContent = "Please fill in this field."; return; }
    try {
      const updated = await api(`/claims/${c.id}/decision`, { action, note });
      m.close(); toast(`${c.id}: ${updated.status}`); renderReview(root, c.id, role, { claim: updated });
    } catch (e) { m.el.querySelector("#err").textContent = e.message; }
  };
}
